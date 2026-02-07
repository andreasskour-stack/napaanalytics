"use client";

import React, { useMemo, useState } from "react";
import type { DuelRow, Meta, SortDir, SortKey } from "@/lib/explorer/types";
import FiltersPanel from "@/components/explorer/FiltersPanel";
import PlayersTable from "@/components/explorer/PlayersTable";
import { aggregatePlayers, defaultFiltersFromMeta, filterRows, sortPlayers } from "@/lib/explorer/logic";

export default function PlayersExplorerClient({
  duels,
  meta,
}: {
  duels: DuelRow[];
  meta: Meta;
}) {
  const [filters, setFilters] = useState(() => defaultFiltersFromMeta(meta));
  const [sortKey, setSortKey] = useState<SortKey>("winPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const resetAll = () => setFilters(defaultFiltersFromMeta(meta));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <FiltersPanel meta={meta} filters={filters} onChange={setFilters} onResetAll={resetAll} />

      <div className="space-y-4">
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
  );
}
