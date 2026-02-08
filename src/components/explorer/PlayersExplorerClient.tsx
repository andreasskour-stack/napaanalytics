"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { DuelRow, Meta, SortDir, SortKey } from "@/lib/explorer/types";
import FiltersPanel from "@/components/explorer/FiltersPanel";
import PlayersTable from "@/components/explorer/PlayersTable";
import MiniCharts from "@/components/explorer/MiniCharts";
import { aggregatePlayers, filterRows, sortPlayers, defaultFiltersFromMeta } from "@/lib/explorer/logic";
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

export default function PlayersExplorerClient({
  duels,
  meta,
  initialQueryString = "",
}: {
  duels: DuelRow[];
  meta: Meta;
  /** Passed from the server page: e.g. "week=3&target=RINGS" (no leading "?") */
  initialQueryString?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string }>(() => ({
    show: false,
    message: "",
  }));
  const toastTimerRef = useRef<number | null>(null);

  // ✅ Build initial state from server-provided query string (no useSearchParams)
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

  // Prevent loops when we update the URL ourselves
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

  // ✅ Listen to browser back/forward and sync state from location.search
  useEffect(() => {
    const onPopState = () => {
      const qs = window.location.search; // includes leading "?" or ""
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

        setTimeout(() => {
          syncingFromUrlRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortKey, sortDir, meta]);

  // Write URL whenever filters/sort change (debounced) — with loop prevention
  useEffect(() => {
    if (syncingFromUrlRef.current) return;

    const nextQuery = buildSearchParamsFromState(filters, sortKey, sortDir, meta);
    const currentQuery = window.location.search || "";

    // If nothing changed, do nothing
    if (nextQuery === currentQuery) return;

    const t = window.setTimeout(() => {
      lastWrittenQueryRef.current = nextQuery || "";
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    }, 250);

    return () => window.clearTimeout(t);
  }, [filters, sortKey, sortDir, meta, router, pathname]);

  const filteredRows = useMemo(() => filterRows(duels, filters), [duels, filters]);
  const playerAgg = useMemo(() => aggregatePlayers(filteredRows), [filteredRows]);
  const sortedAgg = useMemo(() => sortPlayers(playerAgg, sortKey, sortDir), [playerAgg, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const duelRows = filteredRows.length;
    const players = playerAgg.length;
    const wins = filteredRows.reduce((s, r) => s + (r.won ? 1 : 0), 0);
    const winPct = duelRows > 0 ? wins / duelRows : 0;
    return { duelRows, players, winPct };
  }, [filteredRows, playerAgg]);

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

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <FiltersPanel meta={meta} filters={filters} onChange={setFilters} onResetAll={resetAll} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Share this view (filters + sort) using a link.</div>

            <button
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              title="Copy a link to the current filtered view"
            >
              <ShareIcon />
              Share
            </button>
          </div>

          <MiniCharts filteredRows={filteredRows} playersSorted={sortedAgg} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Matched duel rows</div>
              <div className="text-2xl font-bold">{kpis.duelRows}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Players</div>
              <div className="text-2xl font-bold">{kpis.players}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Win% (filtered)</div>
              <div className="text-2xl font-bold">{(kpis.winPct * 100).toFixed(1)}%</div>
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

      {/* Toast (bottom-right) */}
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
