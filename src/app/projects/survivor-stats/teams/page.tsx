"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";
import playersRaw from "@/data/players.json";
import rankingsRaw from "@/data/rankings.json";

const BASE = "/projects/survivor-stats";
const ARCHIVE_INDEX_URL = `${BASE}/api/archive/index`;
const ARCHIVE_FILE_URL = `${BASE}/api/archive/file`;

type Trend = "up" | "down" | "flat";

type PlayerRow = {
  id: string;
  name: string;
  team?: string | null;

  wins?: number;
  duels?: number;
  winPct?: number | null;
  clutch?: number | null;
  choke?: number | null;
  reliability?: number | null;

  power?: number | null;
  power_adj?: number | null;

  eliminatedEpisode?: number | null;
  isEliminated?: boolean;
};

type RankingRow = {
  id: string;
  name: string;
  team?: string;
  power: number;
  trend: Trend;
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
  players: EnrichedPlayer[];
  activePlayers: EnrichedPlayer[];

  teamPower: number;
  depth: number;

  reliabilityAvg: number | null;
  winPctWeighted: number | null;

  mvp: EnrichedPlayer | null;
  riser: EnrichedPlayer | null;
  faller: EnrichedPlayer | null;

  teamTrend: Trend;
  totalCount: number;
  activeCount: number;
};

type ArchiveIndex = {
  rankings: string[];
};

function asArray(input: any): any[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  const candidates = [input.rows, input.data, input.players, input.rankings, input.items, input.values];
  for (const c of candidates) if (Array.isArray(c)) return c;

  if (typeof input === "object") {
    const vals = Object.values(input);
    if (vals.every((v) => v && typeof v === "object")) return vals as any[];
  }
  return [];
}

function normalizeTrend(t: any): Trend {
  const s = String(t ?? "").toLowerCase();
  if (s === "up") return "up";
  if (s === "down") return "down";
  return "flat";
}

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

/* =========================
   Team Trend (Archive) Utils
========================= */

function linregSlope(y: number[]): number {
  const n = y.length;
  if (n < 2) return 0;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const yy = y[i];
    sumX += x;
    sumY += yy;
    sumXY += x * yy;
    sumXX += x * x;
  }

  const num = n * sumXY - sumX * sumY;
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return 0;
  return num / den;
}

function classifySlope(slope: number): Trend {
  if (slope > 0.05) return "up";
  if (slope < -0.05) return "down";
  return "flat";
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function teamLineColor(team: string, t: Trend) {
  const s = (team ?? "").trim().toLowerCase();
  const isRed = s === "athinaioi";
  const isBlue = s === "eparxiotes";

  if (t === "up") {
    if (isRed) return "stroke-red-300";
    if (isBlue) return "stroke-blue-300";
    return "stroke-green-300";
  }
  if (t === "down") {
    if (isRed) return "stroke-red-500";
    if (isBlue) return "stroke-blue-500";
    return "stroke-red-400";
  }

  if (isRed) return "stroke-red-200/70";
  if (isBlue) return "stroke-blue-200/70";
  return "stroke-white/70";
}

function TeamSparkline({
  values,
  team,
  trend,
  width = 620,
  height = 180,
  strokeWidth = 3,
  zoomY = 0.22,
  episodeStart = 1,
}: {
  values: number[];
  team: string;
  trend: Trend;
  width?: number;
  height?: number;
  strokeWidth?: number;
  zoomY?: number;
  episodeStart?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { pathD, pts } = useMemo(() => {
    const n = values.length;
    if (!n) return { pathD: "", pts: [] as { x: number; y: number }[] };

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = Math.max(1e-9, rawMax - rawMin);

    const mid = (rawMin + rawMax) / 2;
    const half = (span / 2) * (1 / Math.max(1e-6, zoomY));
    const min = mid - half;
    const max = mid + half;

    const padX = 18;
    const padY = 14;

    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const pts = values.map((v, i) => {
      const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const t = (v - min) / Math.max(1e-9, max - min);
      const y = padY + (1 - clamp01(t)) * innerH;
      return { x, y };
    });

    const pathD =
      pts.length === 0
        ? ""
        : pts
            .map((p, i) => {
              const cmd = i === 0 ? "M" : "L";
              return `${cmd}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            })
            .join(" ");

    return { pathD, pts };
  }, [values, width, height, zoomY]);

  const strokeClass = teamLineColor(team, trend);
  const lastVal = values.length ? values[values.length - 1] : null;
  const dir = trend === "up" ? "↗" : trend === "down" ? "↘" : "→";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">Team adjusted power trend</div>
        <div className="text-sm font-semibold text-gray-100">
          {dir} {lastVal != null ? lastVal.toFixed(1) : "—"}
        </div>
      </div>

      <svg
        width={width}
        height={height}
        className="block w-full select-none"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <line x1="18" y1={height - 14} x2={width - 18} y2={height - 14} className="stroke-white/10" />
        <line x1="18" y1="14" x2={width - 18} y2="14" className="stroke-white/10" />

        <path d={pathD} className={`${strokeClass} fill-none`} strokeWidth={strokeWidth} strokeLinecap="round" />

        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: "default" }}>
            <circle cx={p.x} cy={p.y} r={10} className="fill-transparent" />
            {hoverIdx === i ? (
              <>
                <circle cx={p.x} cy={p.y} r={4} className="fill-white" />
                <rect
                  x={Math.min(width - 132, p.x + 10)}
                  y={Math.max(6, p.y - 28)}
                  width={124}
                  height={22}
                  rx={8}
                  className="fill-black/80 stroke-white/10"
                />
                <text x={Math.min(width - 120, p.x + 18)} y={Math.max(22, p.y - 12)} className="fill-white text-[11px]">
                  {`EP${episodeStart + i}: ${values[i].toFixed(2)}`}
                </text>
              </>
            ) : null}
          </g>
        ))}
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
        <span>{`EP${episodeStart}`}</span>
        <span>{`EP${episodeStart + Math.max(0, values.length - 1)}`}</span>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const [query, setQuery] = useState("");

  const [teamSeriesByName, setTeamSeriesByName] = useState<
    Record<string, { values: number[]; slope: number; trend: Trend; episodeStart: number }>
  >({});

  useEffect(() => {
    resetGlowDefault();
  }, []);

  const PLAYERS: PlayerRow[] = useMemo(() => asArray(playersRaw) as PlayerRow[], []);
  const RANKINGS: RankingRow[] = useMemo(() => {
    const arr = asArray(rankingsRaw) as any[];
    return arr.map((r) => ({ ...r, trend: normalizeTrend(r?.trend) })) as RankingRow[];
  }, []);

  const rankById = useMemo(() => {
    const map = new Map<string, RankingRow>();
    for (const r of RANKINGS) map.set(String(r.id), r);
    return map;
  }, [RANKINGS]);

  const teamRows: TeamRow[] = useMemo(() => {
    const groups = new Map<string, PlayerRow[]>();

    for (const p of PLAYERS) {
      const rid = String(p.id ?? "");
      const r = rankById.get(rid);
      const team = String((p.team ?? r?.team ?? "")).trim();
      if (!team) continue;

      if (!groups.has(team)) groups.set(team, []);
      groups.get(team)!.push(p);
    }

    const rows = Array.from(groups.entries()).map(([team, ps]) => {
      const enriched: EnrichedPlayer[] = ps.map((p) => {
        const r = rankById.get(String(p.id));

        const power =
          (typeof r?.power === "number" ? r.power : null) ??
          (typeof (p as any).power_adj === "number" ? (p as any).power_adj : null) ??
          (typeof p.power === "number" ? p.power : 0);

        const trend: Trend = r?.trend ?? "flat";

        const out =
          isOut(p) || isOut({ isEliminated: r?.isEliminated, eliminatedEpisode: r?.eliminatedEpisode });

        return { ...p, _power: Number(power) || 0, _trend: trend, _isOut: out };
      });

      const activePlayers = enriched.filter((p) => !p._isOut);

      const totalCount = enriched.length;
      const activeCount = activePlayers.length;

      const depth = activePlayers.reduce((s, p) => s + (p._power ?? 0), 0);
      const teamPower = activeCount > 0 ? depth / activeCount : 0;

      const duelSum = enriched.reduce((s, p) => s + (p.duels ?? 0), 0);
      const winSum = enriched.reduce((s, p) => s + (p.wins ?? 0), 0);
      const winPctWeighted = duelSum > 0 ? (winSum / duelSum) * 100 : null;

      const relVals = activePlayers
        .map((p) => p.reliability)
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      const reliabilityAvg = relVals.length ? relVals.reduce((a, b) => a + b, 0) / relVals.length : null;

      const trendPool = activePlayers.length ? activePlayers : enriched;
      const counts = { up: 0, down: 0, flat: 0 } as Record<Trend, number>;
      for (const p of trendPool) counts[p._trend] += 1;
      const teamTrend: Trend =
        counts.up >= counts.down && counts.up >= counts.flat
          ? "up"
          : counts.down >= counts.up && counts.down >= counts.flat
          ? "down"
          : "flat";

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
  }, [PLAYERS, rankById, query]);

  // ----- Build team series from archive (snapshots ALREADY contain adjusted power) -----
  useEffect(() => {
    let mounted = true;

    async function loadSeries() {
      try {
        // 1) fetch index
        const idxRes = await fetch(ARCHIVE_INDEX_URL, { cache: "no-store" });
        if (!idxRes.ok) return;

        const idx = (await idxRes.json()) as ArchiveIndex;
        const files = (idx?.rankings ?? []).filter((x) => typeof x === "string" && x.includes("rankings_ep_"));
        if (!files.length) return;

        // 2) elimination map (from players.json)
        const elimById = new Map<string, number>();
        for (const p of PLAYERS) {
          const id = String(p.id ?? "");
          const e = p.eliminatedEpisode ?? null;
          if (id && e != null && Number.isFinite(e) && e > 0) elimById.set(id, e);
        }

        // 3) ids by team (current roster)
        const idsByTeam = new Map<string, string[]>();
        for (const t of teamRows) {
          idsByTeam.set(
            t.team,
            t.players.map((p) => String(p.id))
          );
        }

        // 4) load snapshots listed in index
        const snapshots: { ep: number; rows: any[] }[] = [];

        for (const file of files) {
          const epMatch = /rankings_ep_(\d+)\.json$/i.exec(file);
          const ep = epMatch ? Number(epMatch[1]) : NaN;
          if (!Number.isFinite(ep)) continue;

          const url = `${ARCHIVE_FILE_URL}?name=${encodeURIComponent(file)}`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;

          const json = await res.json();
          const rows = asArray(json);
          if (rows.length) snapshots.push({ ep, rows });
        }

        snapshots.sort((a, b) => a.ep - b.ep);
        if (!snapshots.length) return;

        const episodeStart = snapshots[0].ep;

        const series: Record<string, number[]> = {};
        for (const t of teamRows) series[t.team] = [];

        // helper to extract ADJUSTED power from snapshot row
        function getAdjustedFromSnapRow(row: any): number | null {
          const v =
            typeof row?.AdjustedPower === "number"
              ? row.AdjustedPower
              : typeof row?.adjustedPower === "number"
              ? row.adjustedPower
              : typeof row?.power_adj === "number"
              ? row.power_adj
              : typeof row?.powerAdj === "number"
              ? row.powerAdj
              : // fallback (in case your snapshot used "power" but it is actually adjusted)
              typeof row?.power === "number"
              ? row.power
              : typeof row?.Power === "number"
              ? row.Power
              : null;

          return typeof v === "number" && Number.isFinite(v) ? v : null;
        }

        for (const snap of snapshots) {
          const idToRow = new Map<string, any>();
          for (const r of snap.rows) {
            const id = String(r?.id ?? r?.playerId ?? r?.PlayerID ?? r?.PlayerId ?? "");
            if (id) idToRow.set(id, r);
          }

          for (const team of Object.keys(series)) {
            const ids = idsByTeam.get(team) ?? [];
            const vals: number[] = [];

            for (const id of ids) {
              const row = idToRow.get(id);
              if (!row) continue;

              const elimEp = elimById.get(id);
              if (elimEp != null && elimEp > 0 && snap.ep >= elimEp) continue;

              // ✅ snapshots are already adjusted → use directly
              const adjSnap = getAdjustedFromSnapRow(row);
              if (adjSnap == null) continue;

              vals.push(adjSnap);
            }

            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            series[team].push(avg);
          }
        }

        const out: Record<string, { values: number[]; slope: number; trend: Trend; episodeStart: number }> = {};
        for (const [team, values] of Object.entries(series)) {
          const slope = linregSlope(values);
          const trend = classifySlope(slope);
          out[team] = { values, slope, trend, episodeStart };
        }

        if (mounted) setTeamSeriesByName(out);
      } catch {
        // ignore
      }
    }

    loadSeries();
    return () => {
      mounted = false;
    };
  }, [PLAYERS, rankById, teamRows]);

  const h2h = useMemo(() => {
    const a = teamRows.find((t) => t.team.toLowerCase() === "athinaioi");
    const e = teamRows.find((t) => t.team.toLowerCase() === "eparxiotes");
    if (!a || !e) return null;

    const maxTeamPower = Math.max(a.teamPower, e.teamPower, 1);
    const maxDepth = Math.max(a.depth, e.depth, 1);
    const maxRel = Math.max(a.reliabilityAvg ?? 0, e.reliabilityAvg ?? 0, 1);
    const maxWin = Math.max(a.winPctWeighted ?? 0, e.winPctWeighted ?? 0, 1);

    return { a, e, maxTeamPower, maxDepth, maxRel, maxWin };
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

      {teamRows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
          No teams found. This usually means <code className="text-white">players.json</code> didn’t rebuild or the{" "}
          <code className="text-white">team</code> field is missing.
          <div className="mt-3 text-white/70">
            Try: <code className="text-white">npm run players:build</code> then refresh.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {teamRows.map((t) => {
          const trendPack = teamSeriesByName[t.team];

          return (
            <Link key={t.team} href={`${BASE}/teams/${encodeURIComponent(t.team)}`} className="block">
              <div
                className={`rounded-2xl border p-5 ${teamCardStyle(t.team)} cursor-pointer transition hover:border-white/30`}
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

                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-gray-400">Depth</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-100">{fmtNum(t.depth, 0)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-400">Team Power</div>
                    <div className="mt-1 text-lg font-semibold text-gray-100">{fmtNum(t.teamPower, 1)}</div>
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

                {/* ✅ Team adjusted power trend line */}
                {trendPack?.values?.length ? (
                  <div className="mt-4">
                    <TeamSparkline
                      values={trendPack.values}
                      team={t.team}
                      trend={trendPack.trend}
                      width={620}
                      height={180}
                      strokeWidth={3}
                      zoomY={0.95}
                      episodeStart={trendPack.episodeStart}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>Slope: {trendPack.slope.toFixed(3)}</span>
                      <span className="capitalize">Trend: {trendPack.trend}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-gray-400">
                    No archive trend loaded. Ensure the archive index endpoint works at{" "}
                    <code className="text-gray-200">{ARCHIVE_INDEX_URL}</code>.
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-400">MVP (Power)</div>
                    <div className="mt-2 font-semibold text-gray-100">{t.mvp?.name ?? "—"}</div>
                    <div className="mt-1 text-xs text-gray-400">{t.mvp ? `Power ${fmtNum(t.mvp._power, 0)}` : ""}</div>
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
          );
        })}
      </div>

      {/* Head-to-head */}
      {h2h ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-gray-200">Head-to-head</div>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {[h2h.a, h2h.e].map((t) => (
              <div key={t.team} className={`rounded-2xl border p-5 ${teamCardStyle(t.team)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-100">{t.team}</div>
                    <div className="mt-2 text-sm text-gray-300">Team Power</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-100">{fmtNum(t.teamPower, 1)}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-300">Trend</div>
                    <span
                      className={`mt-2 inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                        t.teamTrend
                      )}`}
                    >
                      <TrendIcon t={t.teamTrend} />
                      <span className="ml-2 capitalize">{t.teamTrend}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm text-gray-200">
                  <div>
                    <div className="flex items-center justify-between">
                      <span>Team Power (Avg Active)</span>
                      <span className="font-semibold">{fmtNum(t.teamPower, 1)}</span>
                    </div>
                    <Bar value={t.teamPower} max={h2h.maxTeamPower} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span>Depth (Sum Active)</span>
                      <span className="font-semibold">{fmtNum(t.depth, 0)}</span>
                    </div>
                    <Bar value={t.depth} max={h2h.maxDepth} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span>Reliability (Avg)</span>
                      <span className="font-semibold">{fmtNum(t.reliabilityAvg, 2)}</span>
                    </div>
                    <Bar value={t.reliabilityAvg ?? 0} max={h2h.maxRel} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span>Win % (Weighted)</span>
                      <span className="font-semibold">{fmtPct(t.winPctWeighted)}</span>
                    </div>
                    <Bar value={t.winPctWeighted ?? 0} max={h2h.maxWin} />
                  </div>

                  <Link
                    href={`${BASE}/teams/${encodeURIComponent(t.team)}`}
                    className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
                  >
                    Open team →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
