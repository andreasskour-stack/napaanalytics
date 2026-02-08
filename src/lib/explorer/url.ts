// src/lib/explorer/url.ts
import type { Filters, Meta, PuzzleMode, SortDir, SortKey } from "./types";

/**
 * URL param conventions:
 *  - prop=HOOP,RUNNER  (multi)
 *  - target=RINGS,BAGS (multi)
 *  - price=FOOD,CASH   (multi)  <-- GamePrice values
 *  - puzzle=all|only|exclude
 *  - week=3   OR week=1-5
 *  - air=YYYY-MM-DD:YYYY-MM-DD (min:max)
 *  - sort=winPct (optional)
 *  - dir=asc|desc (optional)
 */

function splitCsv(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePuzzleMode(v: string | null): PuzzleMode {
  const s = (v ?? "").toLowerCase();
  if (s === "only") return "ONLY";
  if (s === "exclude") return "EXCLUDE";
  return "ALL";
}

function parseWeekRange(v: string | null): { min: number | null; max: number | null } {
  if (!v) return { min: null, max: null };
  const s = v.trim();
  if (!s) return { min: null, max: null };

  if (s.includes("-")) {
    const [a, b] = s.split("-").map((x) => Number(x.trim()));
    const min = Number.isFinite(a) ? a : null;
    const max = Number.isFinite(b) ? b : null;
    return { min, max };
  }
  const n = Number(s);
  if (Number.isFinite(n)) return { min: n, max: n };
  return { min: null, max: null };
}

function parseAirRange(v: string | null): { min: string | null; max: string | null } {
  if (!v) return { min: null, max: null };
  const s = v.trim();
  if (!s) return { min: null, max: null };

  // air=2026-01-01:2026-02-01
  if (s.includes(":")) {
    const [a, b] = s.split(":").map((x) => x.trim());
    return {
      min: a || null,
      max: b || null,
    };
  }

  // air=2026-01-01 (single day)
  return { min: s, max: s };
}

function safeSortKey(v: string | null): SortKey | null {
  if (!v) return null;
  const s = v.trim();
  const allowed: SortKey[] = [
    "playerId",
    "playerName",
    "winPct",
    "arriveFirstPct",
    "totalDuels",
    "finalPtsWon",
    "normMargin",
    "teamColor",
  ];
  return allowed.includes(s as SortKey) ? (s as SortKey) : null;
}

function safeSortDir(v: string | null): SortDir | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "asc" || s === "desc") return s;
  return null;
}

function setIfNonEmpty(sp: URLSearchParams, key: string, values: string[]) {
  const clean = values.map((x) => x.trim()).filter(Boolean);
  if (clean.length) sp.set(key, clean.join(","));
  else sp.delete(key);
}

export function filtersFromSearchParams(meta: Meta, sp: URLSearchParams): Filters {
  // Defaults are "ALL" and full ranges from meta
  const propTypes = new Set(splitCsv(sp.get("prop")));
  const targetTypes = new Set(splitCsv(sp.get("target")));
  const gamePrices = new Set(splitCsv(sp.get("price")));
  const puzzleMode = parsePuzzleMode(sp.get("puzzle"));

  const weekParsed = parseWeekRange(sp.get("week"));
  const airParsed = parseAirRange(sp.get("air"));

  const weekMin = weekParsed.min ?? (Number.isFinite(meta.ranges.week.min) ? meta.ranges.week.min : null);
  const weekMax = weekParsed.max ?? (Number.isFinite(meta.ranges.week.max) ? meta.ranges.week.max : null);

  const airDateMin = airParsed.min ?? meta.ranges.airDate.min ?? null;
  const airDateMax = airParsed.max ?? meta.ranges.airDate.max ?? null;

  return {
    propTypes,
    targetTypes,
    gamePrices,
    puzzleMode,
    airDateMin,
    airDateMax,
    weekMin,
    weekMax,
  };
}

export function sortFromSearchParams(sp: URLSearchParams): { sortKey: SortKey; sortDir: SortDir } {
  const k = safeSortKey(sp.get("sort")) ?? "winPct";
  const d = safeSortDir(sp.get("dir")) ?? "desc";
  return { sortKey: k, sortDir: d };
}

export function buildSearchParamsFromState(filters: Filters, sortKey: SortKey, sortDir: SortDir, meta: Meta): string {
  const sp = new URLSearchParams();

  setIfNonEmpty(sp, "prop", Array.from(filters.propTypes).sort());
setIfNonEmpty(sp, "target", Array.from(filters.targetTypes).sort());
setIfNonEmpty(sp, "price", Array.from(filters.gamePrices).sort());


  if (filters.puzzleMode !== "ALL") sp.set("puzzle", filters.puzzleMode.toLowerCase());
  else sp.delete("puzzle");

  // week: only set if not full range
  const fullWeekMin = Number.isFinite(meta.ranges.week.min) ? meta.ranges.week.min : null;
  const fullWeekMax = Number.isFinite(meta.ranges.week.max) ? meta.ranges.week.max : null;

  const wMin = filters.weekMin;
  const wMax = filters.weekMax;

  if (wMin !== null && wMax !== null && (wMin !== fullWeekMin || wMax !== fullWeekMax)) {
    if (wMin === wMax) sp.set("week", String(wMin));
    else sp.set("week", `${wMin}-${wMax}`);
  }

  // air: only set if not full range
  const fullAirMin = meta.ranges.airDate.min ?? null;
  const fullAirMax = meta.ranges.airDate.max ?? null;

  const aMin = filters.airDateMin ?? null;
  const aMax = filters.airDateMax ?? null;

  if ((aMin || aMax) && (aMin !== fullAirMin || aMax !== fullAirMax)) {
    if (aMin && aMax && aMin === aMax) sp.set("air", aMin);
    else sp.set("air", `${aMin ?? ""}:${aMax ?? ""}`);
  }

  // sort: only set if not default
  if (!(sortKey === "winPct" && sortDir === "desc")) {
    sp.set("sort", sortKey);
    sp.set("dir", sortDir);
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function stateEquals(a: Filters, b: Filters): boolean {
  // compare sets + primitives
  const sameSet = (x: Set<string>, y: Set<string>) => {
    if (x.size !== y.size) return false;
    for (const v of x) if (!y.has(v)) return false;
    return true;
  };

  return (
    sameSet(a.propTypes, b.propTypes) &&
    sameSet(a.targetTypes, b.targetTypes) &&
    sameSet(a.gamePrices, b.gamePrices) &&
    a.puzzleMode === b.puzzleMode &&
    a.airDateMin === b.airDateMin &&
    a.airDateMax === b.airDateMax &&
    a.weekMin === b.weekMin &&
    a.weekMax === b.weekMax
  );
}
