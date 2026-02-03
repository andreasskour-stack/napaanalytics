"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";
import playersRaw from "@/data/players.json";
import rankingsRaw from "@/data/rankings.json";

const BASE = "/projects/survivor-stats";

type Trend = "up" | "down" | "flat";

type PlayerRow = {
  id: string;
  name: string;
  team: string;
  wins: number;
  duels: number;
  winPct: number | null;
  clutch: number | null;
  choke: number | null;
  reliability: number | null;
  power: number | null;

  // ✅ from players.json (generated)
  eliminatedEpisode?: number | null;
  isEliminated?: boolean;
};

type RankingRow = {
  id: string;
  name: string;
  team: string;
  power: number;
  trend: Trend;

  // (optional) some of your ranking jsons include these too
  eliminatedEpisode?: number | null;
  isEliminated?: boolean;
};

type EnrichedPlayer = PlayerRow & {
  _power: number;
  _trend: Trend;
  _isOut: boolean;
};

type TeamRow = {
  team: string;
  players: EnrichedPlayer[]; // all players (for roster display / counts)
  activePlayers: EnrichedPlayer[];

  // ✅ NEW DEFINITIONS
  teamPower: number; // avg active power
  depth: number; // sum active power

  reliabilityAvg: number | null; // avg active reliability (display-only)
  winPctWeighted: number | null; // keep as season performance (all players)
  mvp: EnrichedPlayer | null;
  riser: EnrichedPlayer | null;
  faller: EnrichedPlayer | null;
  teamTrend: Trend;

  totalCount: number;
  activeCount: number;
};

const PLAYERS: PlayerRow[] = playersRaw as PlayerRow[];
const RANKINGS: RankingRow[] = rankingsRaw as RankingRow[];

function TrendIcon({ t }: { t: Trend }) {
  if (t === "up") return <span className="text-green-400">▲</span>;
  if (t === "down") return <span className="text-red-400">▼</span>;
  return <span className="text-gray-400">•</span>;
}

function teamCardStyle(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  if (t === "athinaioi") return "border-red-400/40 bg-red-500/15";
  if (t === "eparxiotes") return "border-blue-400/40 bg-blue-500/15";
  return "border-white/10 bg-white/5";
}

function teamBadgeStyle(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  if (t === "athinaioi") return "border-red-400/40 bg-red-500/20 text-red-100";
  if (t === "eparxiotes") return "border-blue-400/40 bg-blue-500/20 text-blue-100";
  return "border-white/10 bg-white/5 text-gray-200";
}

function powerBadgeStyle(trend: Trend) {
  if (trend === "up") return "bg-green-500 text-gray-950 border-green-300/70";
  if (trend === "down") return "bg-red-500 text-gray-950 border-red-300/70";
  return "bg-gray-950/30 text-gray-100 border-white/10";
}

function fmtPct(x: number | null | undefined) {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${x.toFixed(1)}%`;
}
function fmtNum(x: number | null | undefined, digits = 1) {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function resetGlowDefault() {
  const root = document.documentElement;
  root.style.setProperty("--glow-a", "255, 59, 48");
  root.style.setProperty("--glow-b", "20, 80, 255");
  root.style.setProperty("--glow-strength", "0.28");
}

function applyTeamGlow(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  const root = document.documentElement;

  const RED = "255, 59, 48";
  const BLUE = "20, 80, 255";
  const NEUTRAL = "120, 120, 120";

  if (t === "athinaioi") {
    root.style.setProperty("--glow-a", RED);
    root.style.setProperty("--glow-b", NEUTRAL);
    root.style.setProperty("--glow-strength", "0.34");
    return;
  }
  if (t === "eparxiotes") {
    root.style.setProperty("--glow-a", NEUTRAL);
    root.style.setProperty("--glow-b", BLUE);
    root.style.setProperty("--glow-strength", "0.34");
    return;
  }

  root.style.setProperty("--glow-a", RED);
  root.style.setProperty("--glow-b", BLUE);
  root.style.setProperty("--glow-strength", "0.28");
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/10">
      <div className="h-2 rounded-full bg-white/60" style={{ width: `${pct}%` }} />
    </div>
  );
}

function isOut(p: { isEliminated?: boolean; eliminatedEpisode?: number | null }) {
  const elimEp = p.eliminatedEpisode;
  return Boolean(p.isEliminated) || (elimEp != null && Number(elimEp) > 0);
}

export default function TeamsPage() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    resetGlowDefault();
  }, []);

  const rankById = useMemo(() => {
    const map = new Map<string, RankingRow>();
    for (const r of RANKINGS) map.set(String(r.id), r);
    return map;
  }, []);

  const teamRows: TeamRow[] = useMemo(() => {
    const groups = new Map<string, PlayerRow[]>();
    for (const p of PLAYERS) {
      const key = (p.team ?? "").trim();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const rows = Array.from(groups.entries()).map(([team, ps]) => {
      const enriched: EnrichedPlayer[] = ps.map((p) => {
        const r = rankById.get(String(p.id));
        const power = r?.power ?? p.power ?? 0;
        const trend = (r?.trend ?? "flat") as Trend;

        // Use player-file elimination fields primarily (most reliable)
        const out =
          isOut(p) ||
          isOut({ isEliminated: r?.isEliminated, eliminatedEpisode: r?.eliminatedEpisode });

        return { ...p, _power: power, _trend: trend, _isOut: out };
      });

      const activePlayers = enriched.filter((p) => !p._isOut);

      const totalCount = enriched.length;
      const activeCount = activePlayers.length;

      // ✅ DEPTH = sum(active power)
      const depth = activePlayers.reduce((s, p) => s + (p._power ?? 0), 0);

      // ✅ TEAM POWER = avg(active power)
      const teamPower = activeCount > 0 ? depth / activeCount : 0;

      // Win% weighted: keep season performance (all players)
      const duelSum = enriched.reduce((s, p) => s + (p.duels ?? 0), 0);
      const winSum = enriched.reduce((s, p) => s + (p.wins ?? 0), 0);
      const winPctWeighted = duelSum > 0 ? (winSum / duelSum) * 100 : null;

      // Reliability avg: active only (display-only, not used as a multiplier)
      const relVals = activePlayers
        .map((p) => p.reliability)
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      const reliabilityAvg =
        relVals.length ? relVals.reduce((a, b) => a + b, 0) / relVals.length : null;

      // Team trend: active only if possible (fallback to all)
      const trendPool = activePlayers.length ? activePlayers : enriched;
      const counts = { up: 0, down: 0, flat: 0 } as Record<Trend, number>;
      for (const p of trendPool) counts[p._trend] += 1;
      const teamTrend: Trend =
        counts.up >= counts.down && counts.up >= counts.flat
          ? "up"
          : counts.down >= counts.up && counts.down >= counts.flat
          ? "down"
          : "flat";

      // MVP / movers: use active if possible (fallback to all)
      const pool = activePlayers.length ? activePlayers : enriched;

      const topByPower = pool.slice().sort((a, b) => (b._power ?? 0) - (a._power ?? 0));
      const mvp = topByPower[0] ?? null;

      const riser =
        pool
          .filter((p) => p._trend === "up")
          .slice()
          .sort((a, b) => (b._power ?? 0) - (a._power ?? 0))[0] ?? null;

      const faller =
        pool
          .filter((p) => p._trend === "down")
          .slice()
          .sort((a, b) => (b._power ?? 0) - (a._power ?? 0))[0] ?? null;

      return {
        team,
        players: enriched,
        activePlayers,
        teamPower,
        depth,
        reliabilityAvg,
        winPctWeighted,
        mvp,
        riser,
        faller,
        teamTrend,
        totalCount,
        activeCount,
      };
    });

    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (q ? r.team.toLowerCase().includes(q) : true))
      .sort((a, b) => b.teamPower - a.teamPower);
  }, [query, rankById]);

  // Head-to-head only for the two known teams
  const h2h = useMemo(() => {
    const a = teamRows.find((t) => t.team.toLowerCase() === "athinaioi");
    const e = teamRows.find((t) => t.team.toLowerCase() === "eparxiotes");
    if (!a || !e) return null;

    const maxTeamPower = Math.max(a.teamPower, e.teamPower, 1);
    const maxDepth = Math.max(a.depth, e.depth, 1);
    const maxRel = Math.max(a.reliabilityAvg ?? 0, e.reliabilityAvg ?? 0, 1);
    const maxWin = Math.max(a.winPctWeighted ?? 0, e.winPctWeighted ?? 0, 1);

    return {
      a,
      e,
      maxTeamPower,
      maxDepth,
      maxRel,
      maxWin,
    };
  }, [teamRows]);

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Team-level performance + MVP + movers."
        right={
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team…"
            className="w-52 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
          />
        }
      />

      {/* Team cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {teamRows.map((t) => (
          <Link
            key={t.team}
            href={`${BASE}/teams/${encodeURIComponent(t.team)}`}
            className="block"
          >
            <div
              className={`rounded-2xl border p-5 ${teamCardStyle(
                t.team
              )} cursor-pointer transition hover:border-white/30`}
              onMouseEnter={() => applyTeamGlow(t.team)}
              onMouseLeave={() => resetGlowDefault()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-lg font-semibold">{t.team}</div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold ${teamBadgeStyle(
                        t.team
                      )}`}
                    >
                      <TrendIcon t={t.teamTrend} />
                      <span className="capitalize">{t.teamTrend}</span>
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-gray-300">
                    Active players:{" "}
                    <span className="text-gray-100">
                      {t.activeCount}/{t.totalCount}
                    </span>
                  </div>
                </div>

                {/* ✅ You asked to show DEPTH where Avg Power was */}
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Depth</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-100">
                    {fmtNum(t.depth, 0)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {/* ✅ You asked to show TEAM POWER (avg active) here */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Team Power</div>
                  <div className="mt-1 text-lg font-semibold text-gray-100">
                    {fmtNum(t.teamPower, 1)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Win % (Weighted)</div>
                  <div className="mt-1 text-lg font-semibold text-gray-100">{fmtPct(t.winPctWeighted)}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Reliability (Avg)</div>
                  <div className="mt-1 text-lg font-semibold text-gray-100">{fmtNum(t.reliabilityAvg, 2)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">MVP (Power)</div>
                  <div className="mt-2 font-semibold text-gray-100">{t.mvp?.name ?? "—"}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {t.mvp ? `Power ${fmtNum(t.mvp._power, 0)}` : ""}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Riser</div>
                  <div className="mt-2 font-semibold text-gray-100">{t.riser?.name ?? "—"}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    {t.riser ? <TrendIcon t="up" /> : null}
                    {t.riser ? `Power ${fmtNum(t.riser._power, 0)}` : ""}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Faller</div>
                  <div className="mt-2 font-semibold text-gray-100">{t.faller?.name ?? "—"}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    {t.faller ? <TrendIcon t="down" /> : null}
                    {t.faller ? `Power ${fmtNum(t.faller._power, 0)}` : ""}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Head-to-head */}
      {h2h ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-gray-200">Head-to-head</div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className={`rounded-2xl border p-5 ${teamCardStyle(h2h.a.team)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-100">{h2h.a.team}</div>
                  <div className="mt-2 text-sm text-gray-300">Team Power</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-100">
                    {fmtNum(h2h.a.teamPower, 1)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">Trend</div>
                  <span
                    className={`mt-2 inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                      h2h.a.teamTrend
                    )}`}
                  >
                    <TrendIcon t={h2h.a.teamTrend} />{" "}
                    <span className="ml-2 capitalize">{h2h.a.teamTrend}</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-200">
                <div>
                  <div className="flex items-center justify-between">
                    <span>Team Power (Avg Active)</span>
                    <span className="font-semibold">{fmtNum(h2h.a.teamPower, 1)}</span>
                  </div>
                  <Bar value={h2h.a.teamPower} max={h2h.maxTeamPower} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Depth (Sum Active)</span>
                    <span className="font-semibold">{fmtNum(h2h.a.depth, 0)}</span>
                  </div>
                  <Bar value={h2h.a.depth} max={h2h.maxDepth} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Reliability (Avg)</span>
                    <span className="font-semibold">{fmtNum(h2h.a.reliabilityAvg, 2)}</span>
                  </div>
                  <Bar value={h2h.a.reliabilityAvg ?? 0} max={h2h.maxRel} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Win % (Weighted)</span>
                    <span className="font-semibold">{fmtPct(h2h.a.winPctWeighted)}</span>
                  </div>
                  <Bar value={h2h.a.winPctWeighted ?? 0} max={h2h.maxWin} />
                </div>

                <Link
                  href={`${BASE}/teams/${encodeURIComponent(h2h.a.team)}`}
                  className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
                >
                  Open team →
                </Link>
              </div>
            </div>

            <div className={`rounded-2xl border p-5 ${teamCardStyle(h2h.e.team)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-100">{h2h.e.team}</div>
                  <div className="mt-2 text-sm text-gray-300">Team Power</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-100">
                    {fmtNum(h2h.e.teamPower, 1)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">Trend</div>
                  <span
                    className={`mt-2 inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                      h2h.e.teamTrend
                    )}`}
                  >
                    <TrendIcon t={h2h.e.teamTrend} />{" "}
                    <span className="ml-2 capitalize">{h2h.e.teamTrend}</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-200">
                <div>
                  <div className="flex items-center justify-between">
                    <span>Team Power (Avg Active)</span>
                    <span className="font-semibold">{fmtNum(h2h.e.teamPower, 1)}</span>
                  </div>
                  <Bar value={h2h.e.teamPower} max={h2h.maxTeamPower} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Depth (Sum Active)</span>
                    <span className="font-semibold">{fmtNum(h2h.e.depth, 0)}</span>
                  </div>
                  <Bar value={h2h.e.depth} max={h2h.maxDepth} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Reliability (Avg)</span>
                    <span className="font-semibold">{fmtNum(h2h.e.reliabilityAvg, 2)}</span>
                  </div>
                  <Bar value={h2h.e.reliabilityAvg ?? 0} max={h2h.maxRel} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span>Win % (Weighted)</span>
                    <span className="font-semibold">{fmtPct(h2h.e.winPctWeighted)}</span>
                  </div>
                  <Bar value={h2h.e.winPctWeighted ?? 0} max={h2h.maxWin} />
                </div>

                <Link
                  href={`${BASE}/teams/${encodeURIComponent(h2h.e.team)}`}
                  className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
                >
                  Open team →
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
