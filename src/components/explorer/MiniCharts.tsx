"use client";

import React, { useMemo } from "react";
import type { DuelRow, PlayerAgg } from "@/lib/explorer/types";

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function safeNum(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function MiniBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-2 rounded-full bg-white/70" style={{ width: `${w * 100}%` }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-xs font-semibold text-white/60">{title}</div>
      {children}
    </div>
  );
}

function TeamLabel({ teamColor }: { teamColor: "Red" | "Blue" }) {
  const name = teamColor === "Red" ? "Athinaioi" : "Eparxiotes";
  const cls = teamColor === "Red" ? "text-red-300" : "text-blue-300";
  return <span className={`font-semibold ${cls}`}>{name}</span>;
}

export default function MiniCharts({
  filteredRows,
  playersSorted,
}: {
  filteredRows: DuelRow[];
  playersSorted: PlayerAgg[];
}) {
  const teamStats = useMemo(() => {
    const teams = {
      Red: { rows: 0, wins: 0 },
      Blue: { rows: 0, wins: 0 },
    } as const;

    for (const r of filteredRows) {
      if (r.teamColor === "Red") {
        teams.Red.rows += 1;
        teams.Red.wins += r.won ? 1 : 0;
      } else if (r.teamColor === "Blue") {
        teams.Blue.rows += 1;
        teams.Blue.wins += r.won ? 1 : 0;
      }
    }

    const redWin = teams.Red.rows ? teams.Red.wins / teams.Red.rows : 0;
    const blueWin = teams.Blue.rows ? teams.Blue.wins / teams.Blue.rows : 0;

    return {
      red: { ...teams.Red, winPct: redWin },
      blue: { ...teams.Blue, winPct: blueWin },
      maxRows: Math.max(teams.Red.rows, teams.Blue.rows),
    };
  }, [filteredRows]);

  const topDominance = useMemo(() => {
    // Use current sort (playersSorted) but take top by Dominance specifically:
    const ranked = [...playersSorted]
      .filter((p) => safeNum(p.normMargin) !== null)
      .sort((a, b) => (safeNum(b.normMargin)! - safeNum(a.normMargin)!))
      .slice(0, 10);

    const max = ranked.reduce((m, p) => Math.max(m, safeNum(p.normMargin) ?? 0), 0);

    return { ranked, max };
  }, [playersSorted]);

  const winsByWeek = useMemo(() => {
    const map = new Map<number, { wins: number; rows: number }>();
    for (const r of filteredRows) {
      const w = r.week;
      if (w === null || w === undefined) continue;
      const cur = map.get(w) ?? { wins: 0, rows: 0 };
      cur.rows += 1;
      cur.wins += r.won ? 1 : 0;
      map.set(w, cur);
    }

    const weeks = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, v]) => ({
        week,
        winPct: v.rows ? v.wins / v.rows : 0,
        rows: v.rows,
      }));

    const maxRows = weeks.reduce((m, x) => Math.max(m, x.rows), 0);

    return { weeks, maxRows };
  }, [filteredRows]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 1) Team Win% */}
      <Card title="Team Win% (filtered)">
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Red" />
              <span className="text-white/90">{pct(teamStats.red.winPct)}</span>
            </div>
            <MiniBar value={teamStats.red.rows} max={teamStats.maxRows} />
            <div className="mt-1 text-xs text-white/60">{teamStats.red.rows} duel rows</div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Blue" />
              <span className="text-white/90">{pct(teamStats.blue.winPct)}</span>
            </div>
            <MiniBar value={teamStats.blue.rows} max={teamStats.maxRows} />
            <div className="mt-1 text-xs text-white/60">{teamStats.blue.rows} duel rows</div>
          </div>
        </div>
      </Card>

      {/* 2) Top Dominance */}
      <Card title="Top Dominance (Top 10)">
        <div className="space-y-2">
          {topDominance.ranked.length === 0 ? (
            <div className="text-xs text-white/60">No dominance values in this filter context.</div>
          ) : (
            topDominance.ranked.map((p) => (
              <div key={p.playerId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="max-w-[75%] truncate text-white/90">{p.playerName}</span>
                  <span className="text-white/70">{(p.normMargin ?? 0).toFixed(3)}</span>
                </div>
                <MiniBar value={p.normMargin ?? 0} max={topDominance.max || 1} />
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 3) Wins by Week */}
      <Card title="Wins by Week (Win%)">
        <div className="space-y-2">
          {winsByWeek.weeks.length === 0 ? (
            <div className="text-xs text-white/60">No week data in this filter context.</div>
          ) : (
            winsByWeek.weeks.map((w) => (
              <div key={w.week} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/90">Week {w.week}</span>
                  <span className="text-white/70">{pct(w.winPct)}</span>
                </div>
                <MiniBar value={w.rows} max={winsByWeek.maxRows || 1} />
              </div>
            ))
          )}
        </div>
        <div className="mt-2 text-xs text-white/50">
          Bar length = duel rows in that week (context size).
        </div>
      </Card>
    </div>
  );
}
