"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { DuelRow, Meta, SortDir, SortKey } from "@/lib/explorer/types";
import FiltersPanel from "@/components/explorer/FiltersPanel";
import PlayersTable from "@/components/explorer/PlayersTable";
import MiniCharts from "@/components/explorer/MiniCharts";
import {
  aggregatePlayers,
  filterRows,
  sortPlayers,
  defaultFiltersFromMeta,
} from "@/lib/explorer/logic";
import {
  buildSearchParamsFromState,
  filtersFromSearchParams,
  sortFromSearchParams,
  stateEquals,
} from "@/lib/explorer/url";

function ShareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 8a3 3 0 1 0-2.83-4H13a3 3 0 0 0 3 3ZM6 14a3 3 0 1 0 2.83 4H9a3 3 0 0 0-3-3Zm10-2a3 3 0 1 0-2.12-5.12L8.7 9.46A3 3 0 0 0 8 12c0 .28.04.56.1.82l5.78 2.89c.55-.44 1.24-.71 1.99-.71Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 12.6l5.6 2.8M8.7 10.5l5.2-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
      aria-pressed={value}
      title={label}
    >
      <span
        className={[
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          value ? "bg-white/40" : "bg-white/20",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            value ? "translate-x-4" : "translate-x-1",
          ].join(" ")}
        />
      </span>
      <span className="text-white/90">{label}</span>
    </button>
  );
}

type PresetKey = "puzzle" | "high_stakes" | "final_weeks";

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function safeNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt3(n: number | null) {
  if (n === null) return "—";
  return n.toFixed(3);
}

function toCsvValue(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function distinctDuelCount(rows: DuelRow[]) {
  const set = new Set<string>();
  for (const r of rows as any[]) {
    const key = r.duelKey ? String(r.duelKey) : `d${r.duelId}`;
    set.add(key);
  }
  return set.size;
}

type TeamKey = "Red" | "Blue";

function isTeamKey(x: unknown): x is TeamKey {
  return x === "Red" || x === "Blue";
}

export default function PlayersExplorerClient({
  duels,
  meta,
  initialQueryString = "",
}: {
  duels: DuelRow[];
  meta: Meta;
  initialQueryString?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string }>(() => ({
    show: false,
    message: "",
  }));
  const toastTimerRef = useRef<number | null>(null);

  // Compare teams toggle
  const [compareTeams, setCompareTeams] = useState(false);

  // Initial state from server query
  const [filters, setFilters] = useState(() => {
    try {
      const sp = new URLSearchParams(initialQueryString);
      return filtersFromSearchParams(meta, sp);
    } catch {
      return defaultFiltersFromMeta(meta);
    }
  });

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const sp = new URLSearchParams(initialQueryString);
    return sortFromSearchParams(sp).sortKey;
  });

  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const sp = new URLSearchParams(initialQueryString);
    return sortFromSearchParams(sp).sortDir;
  });

  // Loop guards
  const lastWrittenQueryRef = useRef<string>(initialQueryString ? `?${initialQueryString}` : "");
  const syncingFromUrlRef = useRef<boolean>(false);

  function showToast(message: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ show: true, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast({ show: false, message: "" });
      toastTimerRef.current = null;
    }, 1400);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function syncStateFromSearchParams(sp: URLSearchParams, setLastWritten = true) {
    const nextFilters = filtersFromSearchParams(meta, sp);
    const nextSort = sortFromSearchParams(sp);

    syncingFromUrlRef.current = true;
    setFilters(nextFilters);
    setSortKey(nextSort.sortKey);
    setSortDir(nextSort.sortDir);

    if (setLastWritten) {
      const qs = sp.toString();
      lastWrittenQueryRef.current = qs ? `?${qs}` : "";
    }

    setTimeout(() => {
      syncingFromUrlRef.current = false;
    }, 0);
  }

  // On first mount: apply actual URL (refresh/new tab)
  useEffect(() => {
    const qs = window.location.search;
    if (!qs) return;
    const sp = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
    syncStateFromSearchParams(sp, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  // Back/forward
  useEffect(() => {
    const onPopState = () => {
      const qs = window.location.search || "";
      if (qs === lastWrittenQueryRef.current) return;

      const sp = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
      const nextFilters = filtersFromSearchParams(meta, sp);
      const nextSort = sortFromSearchParams(sp);

      const needFilters = !stateEquals(filters, nextFilters);
      const needSort = sortKey !== nextSort.sortKey || sortDir !== nextSort.sortDir;

      if (needFilters || needSort) {
        syncingFromUrlRef.current = true;
        if (needFilters) setFilters(nextFilters);
        if (needSort) {
          setSortKey(nextSort.sortKey);
          setSortDir(nextSort.sortDir);
        }
        lastWrittenQueryRef.current = qs;
        setTimeout(() => (syncingFromUrlRef.current = false), 0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortKey, sortDir, meta]);

  // Write URL when filters/sort change
  useEffect(() => {
    if (syncingFromUrlRef.current) return;

    const nextQuery = buildSearchParamsFromState(filters, sortKey, sortDir, meta);
    const currentQuery = window.location.search || "";

    if (nextQuery === currentQuery) return;

    const t = window.setTimeout(() => {
      lastWrittenQueryRef.current = nextQuery || "";
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    }, 250);

    return () => window.clearTimeout(t);
  }, [filters, sortKey, sortDir, meta, router, pathname]);

  // Data
  const filteredRows = useMemo(() => filterRows(duels, filters), [duels, filters]);
  const playerAgg = useMemo(() => aggregatePlayers(filteredRows), [filteredRows]);
  const sortedAgg = useMemo(
    () => sortPlayers(playerAgg, sortKey, sortDir),
    [playerAgg, sortKey, sortDir]
  );

  const kpis = useMemo(() => {
    const matchedRows = filteredRows.length;
    const actualDuels = distinctDuelCount(filteredRows);
    const players = playerAgg.length;
    return { matchedRows, actualDuels, players };
  }, [filteredRows, playerAgg]);

  /**
   * ✅ Compare teams cards:
   * - Win%
   * - Dominance (avg normMargin)
   */
  const teamCompare = useMemo(() => {
    const acc = {
      Red: { rows: 0, wins: 0, mSum: 0, mN: 0 },
      Blue: { rows: 0, wins: 0, mSum: 0, mN: 0 },
    };

    for (const rr of filteredRows) {

  const t: unknown = (rr as any).teamColor;

  if (!isTeamKey(t)) continue;

  acc[t].rows += 1;
  acc[t].wins += (rr as any).won ? 1 : 0;

  const m = safeNum((rr as any).normMargin);

      if (m !== null) {
        acc[t].mSum += m;
        acc[t].mN += 1;
      }
    }

    return {
      red: {
        rows: acc.Red.rows,
        wins: acc.Red.wins,
        winPct: acc.Red.rows ? acc.Red.wins / acc.Red.rows : 0,
        dominance: acc.Red.mN ? acc.Red.mSum / acc.Red.mN : null,
      },
      blue: {
        rows: acc.Blue.rows,
        wins: acc.Blue.wins,
        winPct: acc.Blue.rows ? acc.Blue.wins / acc.Blue.rows : 0,
        dominance: acc.Blue.mN ? acc.Blue.mSum / acc.Blue.mN : null,
      },
    };
  }, [filteredRows]);

  const resetAll = () => {
    setFilters(defaultFiltersFromMeta(meta));
    setSortKey("winPct");
    setSortDir("desc");
    showToast("Reset to defaults");
  };

  async function onShare() {
    try {
      const url = window.location.href;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("Link copied!");
    } catch {
      const url = window.location.href;
      window.prompt("Copy this link:", url);
    }
  }

  function pickHighPriceFromMeta(): string[] {
    const values: string[] =
      Array.isArray((meta as any)?.values?.gamePrice)
        ? (meta as any).values.gamePrice
        : Array.isArray((meta as any)?.values?.price)
          ? (meta as any).values.price
          : Array.isArray((meta as any)?.values?.gamePrices)
            ? (meta as any).values.gamePrices
            : Array.isArray((meta as any)?.gamePrices)
              ? (meta as any).gamePrices
              : [];

    if (!values.length) return ["HIGH"];
    const sorted = [...values].map(String).sort((a, b) => a.localeCompare(b));
    return [sorted[sorted.length - 1]];
  }

  function applyPreset(preset: PresetKey) {
    const sp = new URLSearchParams(
      window.location.search.startsWith("?") ? window.location.search.slice(1) : ""
    );

    if (preset === "puzzle") {
      sp.set("puzzle", "only");
      showToast("Preset: Puzzle only");
    }

    if (preset === "final_weeks") {
      const fullMin = Number.isFinite(meta?.ranges?.week?.min) ? meta.ranges.week.min : null;
      const fullMax = Number.isFinite(meta?.ranges?.week?.max) ? meta.ranges.week.max : null;

      if (fullMin !== null && fullMax !== null) {
        const start = Math.max(fullMin, fullMax - 2);
        sp.set("week", start === fullMax ? String(fullMax) : `${start}-${fullMax}`);
        showToast(`Preset: Final weeks (${start}-${fullMax})`);
      } else {
        showToast("Preset: Final weeks (week range missing)");
        sp.delete("week");
      }
    }

    if (preset === "high_stakes") {
      const pick = pickHighPriceFromMeta();
      sp.set("price", pick.join(","));
      showToast(`Preset: High stakes (${pick.join(", ")})`);
    }

    syncStateFromSearchParams(sp, true);
    const qs = sp.toString();
    const nextUrl = `${pathname}${qs ? `?${qs}` : ""}`;
    router.replace(nextUrl, { scroll: false });
  }

  function exportCsv() {
    const rows = sortedAgg as any[];

    const header = ["PlayerID", "Name", "Team", "Win%", "ArriveFirst%", "TotalDuels", "FinalPtsWon", "Dominance"];
    const lines = [header.map(toCsvValue).join(",")];

    for (const r of rows) {
      const playerId = r.playerId ?? r.id ?? "";
      const name = r.playerName ?? r.name ?? "";
      const team =
        r.teamName ??
        r.team ??
        (r.teamColor ? (r.teamColor === "Red" ? "Athinaioi" : "Eparxiotes") : "");

      const winPctVal = safeNum(r.winPct) ?? safeNum(r.winPercent);
      const arriveFirst = safeNum(r.arriveFirstPct) ?? safeNum(r.arriveFirst);

      const totalDuels = safeNum(r.totalDuels) ?? safeNum(r.duels);
      const finalPtsWon = safeNum(r.finalPtsWon) ?? safeNum(r.pointsWon);

      const dominance = safeNum(r.normMargin) ?? safeNum(r.dominance);

      const line = [
        playerId,
        name,
        team,
        winPctVal == null ? "" : (winPctVal * 100).toFixed(1),
        arriveFirst == null ? "" : (arriveFirst * 100).toFixed(1),
        totalDuels ?? "",
        finalPtsWon ?? "",
        dominance == null ? "" : dominance.toFixed(3),
      ];

      lines.push(line.map(toCsvValue).join(","));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "players_explorer_filtered.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Exported CSV");
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <FiltersPanel meta={meta} filters={filters} onChange={setFilters} onResetAll={resetAll} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-white/70">Power tools: presets, compare, export.</div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyPreset("puzzle")}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Puzzle only
              </button>
              <button
                onClick={() => applyPreset("high_stakes")}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                High stakes
              </button>
              <button
                onClick={() => applyPreset("final_weeks")}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Final weeks
              </button>

              <Toggle label="Compare teams" value={compareTeams} onChange={setCompareTeams} />

              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                title="Download current sorted table as CSV"
              >
                <DownloadIcon />
                Export CSV
              </button>

              <button
                onClick={onShare}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                title="Copy a link to the current filtered view"
              >
                <ShareIcon />
                Share
              </button>
            </div>
          </div>

          {/* ✅ Compare Teams cards (THIS is where dominance should live) */}
          {compareTeams && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 text-sm font-semibold text-red-300">{teamLabel("Red")}</div>

                <div className="text-xs text-white/60">Win%</div>
                <div className="text-2xl font-bold">{pct(teamCompare.red.winPct)}</div>

                <div className="mt-2 text-xs text-white/60">Dominance (avg margin)</div>
                <div className="text-lg font-semibold text-white/90">{fmt3(teamCompare.red.dominance)}</div>

                <div className="mt-2 text-xs text-white/50">
                  {teamCompare.red.wins} wins / {teamCompare.red.rows} participations
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 text-sm font-semibold text-blue-300">{teamLabel("Blue")}</div>

                <div className="text-xs text-white/60">Win%</div>
                <div className="text-2xl font-bold">{pct(teamCompare.blue.winPct)}</div>

                <div className="mt-2 text-xs text-white/60">Dominance (avg margin)</div>
                <div className="text-lg font-semibold text-white/90">{fmt3(teamCompare.blue.dominance)}</div>

                <div className="mt-2 text-xs text-white/50">
                  {teamCompare.blue.wins} wins / {teamCompare.blue.rows} participations
                </div>
              </div>
            </div>
          )}

          {/* MiniCharts stays clean */}
          <MiniCharts filteredRows={filteredRows} playersSorted={sortedAgg} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Actual duels</div>
              <div className="text-2xl font-bold">{kpis.actualDuels}</div>
              <div className="mt-1 text-xs text-white/50">Distinct duels</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Players</div>
              <div className="text-2xl font-bold">{kpis.players}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Matched duel rows</div>
              <div className="text-2xl font-bold">{kpis.matchedRows}</div>
              <div className="mt-1 text-xs text-white/50">2 rows per duel (by design)</div>
            </div>
          </div>

          <PlayersTable
            rows={sortedAgg}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={(k, d) => {
              setSortKey(k);
              setSortDir(d);
            }}
          />
        </div>
      </div>

      {/* Toast */}
      <div
        className={[
          "fixed bottom-4 right-4 z-50 transition-all duration-200",
          toast.show ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2",
        ].join(" ")}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
          {toast.message}
        </div>
      </div>
    </>
  );
}

// helper for team names in compare panel
function teamLabel(teamColor: "Red" | "Blue") {
  return teamColor === "Red" ? "Athinaioi" : "Eparxiotes";
}
