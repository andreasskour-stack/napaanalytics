"use client";

import React, { useMemo } from "react";
import type { DuelRow, PlayerAgg } from "@/lib/explorer/types";

type TeamKey = "Red" | "Blue";

function isTeamKey(x: unknown): x is TeamKey {
  return x === "Red" || x === "Blue";
}

function safeNum(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
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
          "transition-[width] duration-300 ease-out",
        ].join(" ")}
        style={{ width: `${w * 100}%` }}
      />
    </div>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
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

function TeamLabel({ teamColor }: { teamColor: TeamKey }) {
  const name = teamColor === "Red" ? "Athinaioi" : "Eparxiotes";
  const cls = teamColor === "Red" ? "text-red-300" : "text-blue-300";
  return <span className={`font-semibold ${cls}`}>{name}</span>;
}

function fmt3(n: number | null) {
  if (n === null) return "—";
  return n.toFixed(3);
}

function fmt2(n: number | null) {
  if (n === null) return "—";
  return n.toFixed(2);
}

export default function MiniCharts({
  filteredRows,
  playersSorted,
}: {
  filteredRows: DuelRow[];
  playersSorted: PlayerAgg[];
}) {
  /**
   * ✅ Team Win% + Dominance number (avg normMargin) from duel rows
   * - Win% here is "participation win%" (because explorer duplicates each duel into 2 rows)
   * - Dominance uses avg normMargin per team rows (skips nulls)
   */
  const teamWinAndDominance = useMemo(() => {
    const acc: Record<
      TeamKey,
      { rows: number; wins: number; mSum: number; mN: number }
    > = {
      Red: { rows: 0, wins: 0, mSum: 0, mN: 0 },
      Blue: { rows: 0, wins: 0, mSum: 0, mN: 0 },
    };

    for (const rr of filteredRows) {
      // rr.teamColor may not be typed as TeamKey in DuelRow, so treat as unknown and narrow
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

    const redWin = acc.Red.rows ? acc.Red.wins / acc.Red.rows : 0;
    const blueWin = acc.Blue.rows ? acc.Blue.wins / acc.Blue.rows : 0;

    const redDom = acc.Red.mN ? acc.Red.mSum / acc.Red.mN : null;
    const blueDom = acc.Blue.mN ? acc.Blue.mSum / acc.Blue.mN : null;

    return {
      red: { ...acc.Red, winPct: redWin, dominance: redDom },
      blue: { ...acc.Blue, winPct: blueWin, dominance: blueDom },
      maxRows: Math.max(acc.Red.rows, acc.Blue.rows),
    };
  }, [filteredRows]);

  /**
   * ✅ Team Avg Adjusted Power from duel rows
   * We read `adjustedPower` directly (added by build_explorer_duels).
   */
  const teamAdjPower = useMemo(() => {
    const acc: Record<TeamKey, { sum: number; n: number }> = {
      Red: { sum: 0, n: 0 },
      Blue: { sum: 0, n: 0 },
    };

    for (const rr of filteredRows) {
      const t: unknown = (rr as any).teamColor;
      if (!isTeamKey(t)) continue;

      const p = safeNum((rr as any).adjustedPower);
      if (p === null) continue;

      acc[t].sum += p;
      acc[t].n += 1;
    }

    const redAvg = acc.Red.n ? acc.Red.sum / acc.Red.n : null;
    const blueAvg = acc.Blue.n ? acc.Blue.sum / acc.Blue.n : null;

    const max = Math.max(Math.abs(redAvg ?? 0), Math.abs(blueAvg ?? 0), 1e-9);

    return {
      redAvg,
      blueAvg,
      max,
      redN: acc.Red.n,
      blueN: acc.Blue.n,
    };
  }, [filteredRows]);

  /**
   * ✅ Top Dominance (Top 10 players) — keeps your existing logic
   */
  const topDominance = useMemo(() => {
    const ranked = [...(playersSorted as any[])]
      .filter((p) => safeNum(p.normMargin) !== null)
      .sort((a, b) => (safeNum(b.normMargin)! - safeNum(a.normMargin)!))
      .slice(0, 10);

    const max = ranked.reduce(
      (m, p) => Math.max(m, safeNum(p.normMargin) ?? 0),
      0
    );
    return { ranked, max };
  }, [playersSorted]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 1) Team Win% + Dominance number */}
      <Card title="Team Win% (filtered)" right={<span>Dominance shown as number</span>}>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Red" />
              <span className="text-white/90">{pct(teamWinAndDominance.red.winPct)}</span>
            </div>
            <Bar
              value={teamWinAndDominance.red.rows}
              max={teamWinAndDominance.maxRows || 1}
              tone="red"
            />
            <div className="mt-1 text-xs text-white/60">
              {teamWinAndDominance.red.wins} wins / {teamWinAndDominance.red.rows} participations
              <span className="ml-2 text-white/50">
                • Dominance: {fmt3(teamWinAndDominance.red.dominance)}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Blue" />
              <span className="text-white/90">{pct(teamWinAndDominance.blue.winPct)}</span>
            </div>
            <Bar
              value={teamWinAndDominance.blue.rows}
              max={teamWinAndDominance.maxRows || 1}
              tone="blue"
            />
            <div className="mt-1 text-xs text-white/60">
              {teamWinAndDominance.blue.wins} wins / {teamWinAndDominance.blue.rows} participations
              <span className="ml-2 text-white/50">
                • Dominance: {fmt3(teamWinAndDominance.blue.dominance)}
              </span>
            </div>
          </div>

          <div className="mt-2 text-xs text-white/50">
            Note: Explorer uses 2 rows per duel, so Win% is “participation win%”.
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
            <div className="text-xs text-white/60">
              No dominance values in this filter context.
            </div>
          ) : (
            topDominance.ranked.map((p: any) => {
              const tone =
                p.teamColor === "Red" ? "red" : p.teamColor === "Blue" ? "blue" : "neutral";
              const v = safeNum(p.normMargin) ?? 0;
              const tip = `Avg margin per duel: ${v.toFixed(3)}`;

              return (
                <div key={p.playerId} className="space-y-1" title={tip}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="max-w-[75%] truncate text-white/90">{p.playerName}</span>
                    <span className="text-white/70">{v.toFixed(3)}</span>
                  </div>
                  <Bar value={v} max={topDominance.max || 1} tone={tone as any} />
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 3) Team Avg Adjusted Power */}
      <Card
        title="Team Avg Adjusted Power"
        right={<span>From duels.csv (PlayerPower/OpponentPower)</span>}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Red" />
              <span className="text-white/90">{fmt2(teamAdjPower.redAvg)}</span>
            </div>
            <Bar value={Math.abs(teamAdjPower.redAvg ?? 0)} max={teamAdjPower.max} tone="red" />
            <div className="mt-1 text-xs text-white/60">{teamAdjPower.redN} duel rows w/ power</div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <TeamLabel teamColor="Blue" />
              <span className="text-white/90">{fmt2(teamAdjPower.blueAvg)}</span>
            </div>
            <Bar value={Math.abs(teamAdjPower.blueAvg ?? 0)} max={teamAdjPower.max} tone="blue" />
            <div className="mt-1 text-xs text-white/60">{teamAdjPower.blueN} duel rows w/ power</div>
          </div>

          <div className="mt-2 text-xs text-white/50">
            If this shows “—”, rebuild explorer JSON and confirm duels.v1.json includes adjustedPower.
          </div>
        </div>
      </Card>
    </div>
  );
}
