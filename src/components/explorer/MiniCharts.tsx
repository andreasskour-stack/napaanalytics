"use client";

import React, { useMemo } from "react";
import type { DuelRow, PlayerAgg } from "@/lib/explorer/types";

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function safeNum(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function Bar({
  value,
  max,
  tone = "neutral",
}: {
  value: number;
  max: number;
  tone?: "neutral" | "red" | "blue";
}) {
  const w = max > 0 ? clamp01(value / max) : 0;

  const fill =
    tone === "red"
      ? "bg-red-400/80"
      : tone === "blue"
        ? "bg-blue-400/80"
        : "bg-white/70";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={[
          "h-2 rounded-full",
          fill,
          // ✅ animate widths when filters change
          "transition-[width] duration-300 ease-out",
        ].join(" ")}
        style={{ width: `${w * 100}%` }}
      />
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-white/60">{title}</div>
        {right ? <div className="text-[11px] text-white/50">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function TeamLabel({ teamColor }: { teamColor: "Red" | "Blue" }) {
  const name = teamColor === "Red" ? "Athinaioi" : "Eparxiotes";
  const cls = teamColor === "Red" ? "text-red-300" : "text-blue-300";
  return <span className={`font-semibold ${cls}`}>{name}</span>;
}

function ToneFromTeamColor(teamColor: "Red" | "Blue") {
  return teamColor === "Red" ? "red" : "blue";
}

export default function MiniCharts({
  filteredRows,
  playersSorted,
}: {
  filteredRows: DuelRow[];
  playersSorted: PlayerAgg[];
}) {
  const teamStats = useMemo(() => {
    const teams: Record<"Red" | "Blue", { rows: number; wins: number }> = {
      Red: { rows: 0, wins: 0 },
      Blue: { rows: 0, wins: 0 },
    };

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
    const ranked = [...playersSorted]
      .filter((p) => safeNum(p.normMargin) !== null)
      .sort((a, b) => (safeNum(b.normMargin)! - safeNum(a.normMargin)!))
      .slice(0, 10);

    const max = ranked.reduce((m, p) => Math.max(m, safeNum(p.normMargin) ?? 0), 0);
    return { ranked, max };
  }, [playersSorted]);

  const winsByWeek = useMemo(() => {
    const map = new Map<number, { wins: number; rows: number; redRows: number; blueRows: number }>();

    for (const r of filteredRows) {
      const w = r.week;
      if (w === null || w === undefined) continue;

      const cur = map.get(w) ?? { wins: 0, rows: 0, redRows: 0, blueRows: 0 };
      cur.rows += 1;
      cur.wins += r.won ? 1 : 0;
      if (r.teamColor === "Red") cur.redRows += 1;
      if (r.teamColor === "Blue") cur.blueRows += 1;
      map.set(w, cur);
    }

    const weeks = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, v]) => ({
        week,
        winPct: v.rows ? v.wins / v.rows : 0,
        rows: v.rows,
        redRows: v.redRows,
        blueRows: v.blueRows,
      }));

    const maxRows = weeks.reduce((m, x) => Math.max(m, x.rows), 0);

    return { weeks, maxRows };
  }, [filteredRows]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 1) Team Win% */}
      <Card title="Team Win% (filtered)" right={<span>Bar = duel rows</span>}>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Red" />
              <span className="text-white/90">{pct(teamStats.red.winPct)}</span>
            </div>
            <Bar value={teamStats.red.rows} max={teamStats.maxRows} tone="red" />
            <div className="mt-1 text-xs text-white/60">{teamStats.red.rows} duel rows</div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Blue" />
              <span className="text-white/90">{pct(teamStats.blue.winPct)}</span>
            </div>
            <Bar value={teamStats.blue.rows} max={teamStats.maxRows} tone="blue" />
            <div className="mt-1 text-xs text-white/60">{teamStats.blue.rows} duel rows</div>
          </div>
        </div>
      </Card>

      {/* 2) Top Dominance */}
      <Card
        title="Top Dominance (Top 10)"
        right={
          <span title="Dominance = Avg margin per duel (higher = more dominant)">
            Avg margin per duel&nbsp;ℹ️
          </span>
        }
      >
        <div className="space-y-2">
          {topDominance.ranked.length === 0 ? (
            <div className="text-xs text-white/60">No dominance values in this filter context.</div>
          ) : (
            topDominance.ranked.map((p) => {
              // Optional: use player.teamColor if your PlayerAgg includes it.
              // Fallback to neutral if not available.
              const tone =
                (p as any).teamColor === "Red"
                  ? "red"
                  : (p as any).teamColor === "Blue"
                    ? "blue"
                    : "neutral";

              const tip = `Avg margin per duel: ${(p.normMargin ?? 0).toFixed(3)}`;

              return (
                <div
                  key={p.playerId}
                  className="space-y-1"
                  title={tip} // ✅ native tooltip on hover
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="max-w-[75%] truncate text-white/90">{p.playerName}</span>
                    <span className="text-white/70">{(p.normMargin ?? 0).toFixed(3)}</span>
                  </div>
                  <Bar value={p.normMargin ?? 0} max={topDominance.max || 1} tone={tone as any} />
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 3) Wins by Week */}
      <Card title="Wins by Week (Win%)" right={<span>Bar = duel rows</span>}>
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

                {/* Two-tone stacked-ish look: show dominant team share as color:
                   - if more red rows than blue -> red bar, else blue bar.
                   (Keeps it simple while still “team colored”). */}
                <Bar
                  value={w.rows}
                  max={winsByWeek.maxRows || 1}
                  tone={w.redRows >= w.blueRows ? "red" : "blue"}
                />
              </div>
            ))
          )}
        </div>
        <div className="mt-2 text-xs text-white/50">
          Tooltip: Dominance chart shows “Avg margin per duel”.
        </div>
      </Card>
    </div>
  );
}
