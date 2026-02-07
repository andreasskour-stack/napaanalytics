// src/lib/explorer/logic.ts
import type { DuelRow, Filters, PlayerAgg, SortDir, SortKey } from "./types";

export function defaultFiltersFromMeta(meta: {
  ranges?: { airDate?: { min: string | null; max: string | null }; week?: { min: number; max: number } };
}) : Filters {
  return {
    propTypes: new Set<string>(),   // empty set means ALL
    targetTypes: new Set<string>(),
    gamePrices: new Set<string>(),
    puzzleMode: "ALL",
    airDateMin: meta?.ranges?.airDate?.min ?? null,
    airDateMax: meta?.ranges?.airDate?.max ?? null,
    weekMin: Number.isFinite(meta?.ranges?.week?.min) ? meta.ranges!.week!.min : null,
    weekMax: Number.isFinite(meta?.ranges?.week?.max) ? meta.ranges!.week!.max : null,
  };
}

function inSetOrAll(value: string, set: Set<string>) {
  if (set.size === 0) return true; // ALL
  return set.has(value);
}

function dateInRange(d: string | null, min: string | null, max: string | null) {
  if (!min && !max) return true;
  if (!d) return false;
  if (min && d < min) return false;
  if (max && d > max) return false;
  return true;
}

function weekInRange(w: number | null, min: number | null, max: number | null) {
  if (min === null && max === null) return true;
  if (w === null) return false;
  if (min !== null && w < min) return false;
  if (max !== null && w > max) return false;
  return true;
}

function puzzlePass(puzzle: boolean | null, mode: "ALL" | "ONLY" | "EXCLUDE") {
  if (mode === "ALL") return true;
  if (mode === "ONLY") return puzzle === true;
  if (mode === "EXCLUDE") return puzzle === false;
  return true;
}

export function filterRows(rows: DuelRow[], f: Filters) {
  return rows.filter((r) => {
    if (!inSetOrAll(r.propType, f.propTypes)) return false;
    if (!inSetOrAll(r.targetType, f.targetTypes)) return false;
    if (!inSetOrAll(r.gamePrice, f.gamePrices)) return false;
    if (!puzzlePass(r.puzzle, f.puzzleMode)) return false;
    if (!dateInRange(r.airDate, f.airDateMin, f.airDateMax)) return false;
    if (!weekInRange(r.week, f.weekMin, f.weekMax)) return false;
    return true;
  });
}

function mean(nums: number[]) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function aggregatePlayers(filtered: DuelRow[]): PlayerAgg[] {
  const byPlayer = new Map<number, DuelRow[]>();
  for (const r of filtered) {
    const arr = byPlayer.get(r.playerId) ?? [];
    arr.push(r);
    byPlayer.set(r.playerId, arr);
  }

  const out: PlayerAgg[] = [];
  for (const [playerId, rows] of byPlayer.entries()) {
    const playerName = rows[0]?.playerName ?? `Player ${playerId}`;

    const totalDuels = rows.length;
    const wins = rows.reduce((s, r) => s + (r.won ? 1 : 0), 0);
    const arrivedFirst = rows.reduce((s, r) => s + (r.arrivedFirst ? 1 : 0), 0);

    const finalPtsWon = rows.reduce((s, r) => {
      if (r.isFinalPoint === 1 && r.won === 1) return s + 1;
      return s;
    }, 0);

    const winPct = totalDuels > 0 ? wins / totalDuels : 0;
    const arriveFirstPct = totalDuels > 0 ? arrivedFirst / totalDuels : 0;

    // Should be consistent per player now
    const teamColor = rows[0]?.teamColor ?? "Unknown";

    const margins: number[] = [];
    for (const r of rows) {
      if (r.normMargin !== null && r.normMargin !== undefined && Number.isFinite(r.normMargin)) {
        margins.push(r.normMargin);
      }
    }
    const normMargin = mean(margins);

    out.push({
      playerId,
      playerName,
      totalDuels,
      wins,
      winPct,
      arrivedFirst,
      arriveFirstPct,
      finalPtsWon,
      teamColor,
      normMargin,
    });
  }

  return out;
}

function cmp(a: any, b: any) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function sortPlayers(rows: PlayerAgg[], key: SortKey, dir: SortDir): PlayerAgg[] {
  const m = dir === "asc" ? 1 : -1;

  return [...rows].sort((A, B) => {
    const a = (A as any)[key];
    const b = (B as any)[key];

    const primary = cmp(a, b) * m;
    if (primary !== 0) return primary;

    const t1 = cmp(B.totalDuels, A.totalDuels); // prefer more duels
    if (t1 !== 0) return t1;
    return cmp(A.playerName, B.playerName);
  });
}
