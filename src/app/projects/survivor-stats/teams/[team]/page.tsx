"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
};

type RankingRow = {
  id: string;
  name: string;
  team: string;
  power: number;
  trend: Trend;
};

type EnrichedPlayer = PlayerRow & {
  _power: number;
  _trend: Trend;
};

const PLAYERS: PlayerRow[] = playersRaw as PlayerRow[];
const RANKINGS: RankingRow[] = rankingsRaw as RankingRow[];

type SortKey =
  | "name"
  | "power"
  | "trend"
  | "wins"
  | "duels"
  | "winPct"
  | "clutch"
  | "choke"
  | "reliability";

type SortDir = "asc" | "desc";

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

function powerBadgeStyle(trend: Trend | undefined) {
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

function applyTeamGlow(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  const root = document.documentElement;

  const RED = "255, 59, 48";
  const BLUE = "20, 80, 255";
  const NEUTRAL = "120, 120, 120";

  // ALL: balanced red + blue (not red-dominant)
  if (t === "all") {
    root.style.setProperty("--glow-a", RED);
    root.style.setProperty("--glow-b", BLUE);
    root.style.setProperty("--glow-strength", "0.28");
    return;
  }

  // Athinaioi -> strong red, muted blue
  if (t === "athinaioi") {
    root.style.setProperty("--glow-a", RED);
    root.style.setProperty("--glow-b", NEUTRAL);
    root.style.setProperty("--glow-strength", "0.34");
    return;
  }

  // Eparxiotes -> strong blue, muted red
  if (t === "eparxiotes") {
    root.style.setProperty("--glow-a", NEUTRAL);
    root.style.setProperty("--glow-b", BLUE);
    root.style.setProperty("--glow-strength", "0.34");
    return;
  }

  // Other teams -> neutral
  root.style.setProperty("--glow-a", NEUTRAL);
  root.style.setProperty("--glow-b", NEUTRAL);
  root.style.setProperty("--glow-strength", "0.20");
}

function resetGlowDefault() {
  const root = document.documentElement;
  root.style.setProperty("--glow-a", "255, 59, 48");
  root.style.setProperty("--glow-b", "20, 80, 255");
  root.style.setProperty("--glow-strength", "0.28");
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-gray-500">↕</span>;
  return dir === "asc" ? (
    <span className="ml-1 text-gray-200">▲</span>
  ) : (
    <span className="ml-1 text-gray-200">▼</span>
  );
}

function asNumber(x: unknown, fallback = -Infinity) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function trendRank(t: Trend) {
  if (t === "up") return 2;
  if (t === "flat") return 1;
  return 0;
}

export default function TeamPage() {
  const params = useParams<{ team: string }>();
  const teamParam = params?.team ? decodeURIComponent(params.team) : "";

  const storageKey = useMemo(
    () => `team_sort:${teamParam.trim().toLowerCase() || "unknown"}`,
    [teamParam]
  );

  const [sortKey, setSortKey] = useState<SortKey>("power");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rosterQuery, setRosterQuery] = useState("");

  // Load remembered sort per team
  useEffect(() => {
    if (!teamParam) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { sortKey?: SortKey; sortDir?: SortDir };
      if (parsed.sortKey) setSortKey(parsed.sortKey);
      if (parsed.sortDir) setSortDir(parsed.sortDir);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamParam]);

  // Persist sort per team
  useEffect(() => {
    if (!teamParam) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortKey, sortDir }));
    } catch {}
  }, [teamParam, sortKey, sortDir, storageKey]);

  const rankById = useMemo(() => {
    const map = new Map<string, RankingRow>();
    for (const r of RANKINGS) map.set(String(r.id), r);
    return map;
  }, []);

  const baseRoster: EnrichedPlayer[] = useMemo(() => {
    const t = teamParam.trim().toLowerCase();
    const roster = PLAYERS.filter((p) => (p.team ?? "").trim().toLowerCase() === t);

    return roster.map((p) => {
      const r = rankById.get(String(p.id));
      const power = r?.power ?? p.power ?? 0;
      const trend = (r?.trend ?? "flat") as Trend;
      return { ...p, _power: power, _trend: trend };
    });
  }, [teamParam, rankById]);

  const teamExists = baseRoster.length > 0;

  const filteredRoster = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    return q
      ? baseRoster.filter((p) => (p.name ?? "").toLowerCase().includes(q))
      : baseRoster;
  }, [baseRoster, rosterQuery]);

  const roster = useMemo(() => {
    const arr = filteredRoster.slice();

    arr.sort((a, b) => {
      let va: any;
      let vb: any;

      switch (sortKey) {
        case "name":
          va = a.name ?? "";
          vb = b.name ?? "";
          return sortDir === "asc"
            ? String(va).localeCompare(String(vb))
            : String(vb).localeCompare(String(va));

        case "power":
          va = a._power ?? 0;
          vb = b._power ?? 0;
          break;

        case "trend":
          va = trendRank(a._trend);
          vb = trendRank(b._trend);
          break;

        case "wins":
          va = a.wins ?? 0;
          vb = b.wins ?? 0;
          break;

        case "duels":
          va = a.duels ?? 0;
          vb = b.duels ?? 0;
          break;

        case "winPct":
          va = a.winPct ?? -Infinity;
          vb = b.winPct ?? -Infinity;
          break;

        case "clutch":
          va = a.clutch ?? -Infinity;
          vb = b.clutch ?? -Infinity;
          break;

        case "choke":
          va = a.choke ?? -Infinity;
          vb = b.choke ?? -Infinity;
          break;

        case "reliability":
          va = a.reliability ?? -Infinity;
          vb = b.reliability ?? -Infinity;
          break;
      }

      const na = asNumber(va, -Infinity);
      const nb = asNumber(vb, -Infinity);

      if (na === nb) {
        const pa = a._power ?? 0;
        const pb = b._power ?? 0;
        return pb - pa;
      }

      return sortDir === "asc" ? na - nb : nb - na;
    });

    return arr;
  }, [filteredRoster, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir(key === "name" ? "asc" : "desc");
        return key;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  useEffect(() => {
    if (teamParam) applyTeamGlow(teamParam);
    return () => resetGlowDefault();
  }, [teamParam]);

  const kpis = useMemo(() => {
    const n = baseRoster.length || 1;
    const powerSum = baseRoster.reduce((s, p) => s + (p._power ?? 0), 0);
    const powerAvg = powerSum / n;

    const duelSum = baseRoster.reduce((s, p) => s + (p.duels ?? 0), 0);
    const winSum = baseRoster.reduce((s, p) => s + (p.wins ?? 0), 0);
    const winPctWeighted = duelSum > 0 ? (winSum / duelSum) * 100 : null;

    const relVals = baseRoster
      .map((p) => p.reliability)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    const reliabilityAvg = relVals.length ? relVals.reduce((a, b) => a + b, 0) / relVals.length : null;

    const counts = { up: 0, down: 0, flat: 0 };
    for (const p of baseRoster) counts[p._trend] += 1;
    const teamTrend: Trend =
      counts.up >= counts.down && counts.up >= counts.flat
        ? "up"
        : counts.down >= counts.up && counts.down >= counts.flat
        ? "down"
        : "flat";

    const topByPower = baseRoster.slice().sort((a, b) => (b._power ?? 0) - (a._power ?? 0));
    const mvp = topByPower[0] ?? null;

    const riser =
      baseRoster
        .filter((p) => p._trend === "up")
        .slice()
        .sort((a, b) => (b._power ?? 0) - (a._power ?? 0))[0] ?? null;

    const faller =
      baseRoster
        .filter((p) => p._trend === "down")
        .slice()
        .sort((a, b) => (b._power ?? 0) - (a._power ?? 0))[0] ?? null;

    return { powerSum, powerAvg, winPctWeighted, reliabilityAvg, teamTrend, mvp, riser, faller };
  }, [baseRoster]);

  if (!teamExists) {
    return (
      <>
        <PageHeader
          title="Team not found"
          subtitle={`No players found for: ${teamParam}`}
          right={
            <Link
              href={`${BASE}/teams`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              ← Back to Teams
            </Link>
          }
        />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-200">
          Try:
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`${BASE}/teams/Athinaioi`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              /teams/Athinaioi
            </Link>
            <Link
              href={`${BASE}/teams/Eparxiotes`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              /teams/Eparxiotes
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={teamParam}
        subtitle="Team overview + MVP + movers + sortable roster."
        right={
          <Link
            href={`${BASE}/teams`}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 hover:bg-white/10"
          >
            ← Back to Teams
          </Link>
        }
      />

      <div className={`rounded-2xl border p-5 ${teamCardStyle(teamParam)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold ${teamBadgeStyle(
                teamParam
              )}`}
            >
              <TrendIcon t={kpis.teamTrend} />
              <span className="capitalize">{kpis.teamTrend}</span>
            </span>
            <div className="mt-2 text-sm text-gray-300">
              Players: <span className="text-gray-100">{baseRoster.length}</span>
              {rosterQuery.trim() ? (
                <>
                  {" "}
                  • Showing: <span className="text-gray-100">{filteredRoster.length}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">Avg Power</div>
            <div className="mt-1 text-3xl font-semibold text-gray-100">{fmtNum(kpis.powerAvg, 1)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Team Power (Sum)" value={fmtNum(kpis.powerSum, 0)} />
          <StatCard label="Win % (Weighted)" value={fmtPct(kpis.winPctWeighted)} />
          <StatCard label="Reliability (Avg)" value={fmtNum(kpis.reliabilityAvg, 2)} />
          <StatCard label="Roster Size" value={baseRoster.length} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">MVP (Power)</div>
            <div className="mt-2 text-sm font-semibold text-gray-100">{kpis.mvp?.name ?? "—"}</div>
            <div className="mt-1 text-xs text-gray-400">{kpis.mvp ? `Power ${fmtNum(kpis.mvp._power, 0)}` : ""}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Riser</div>
            <div className="mt-2 text-sm font-semibold text-gray-100">{kpis.riser?.name ?? "—"}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              {kpis.riser ? <TrendIcon t="up" /> : null}
              {kpis.riser ? `Power ${fmtNum(kpis.riser._power, 0)}` : ""}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Faller</div>
            <div className="mt-2 text-sm font-semibold text-gray-100">{kpis.faller?.name ?? "—"}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              {kpis.faller ? <TrendIcon t="down" /> : null}
              {kpis.faller ? `Power ${fmtNum(kpis.faller._power, 0)}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-200">Roster (click column headers to sort)</div>

            <input
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder="Search roster…"
              className="w-52 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-gray-300">
              <tr>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("name")}>
                    Name <SortIndicator active={sortKey === "name"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("power")}>
                    Power <SortIndicator active={sortKey === "power"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("trend")}>
                    Trend <SortIndicator active={sortKey === "trend"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("wins")}>
                    Wins <SortIndicator active={sortKey === "wins"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("duels")}>
                    Duels <SortIndicator active={sortKey === "duels"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("winPct")}>
                    Win % <SortIndicator active={sortKey === "winPct"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("clutch")}>
                    Clutch <SortIndicator active={sortKey === "clutch"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("choke")}>
                    Choke <SortIndicator active={sortKey === "choke"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="hover:underline" onClick={() => toggleSort("reliability")}>
                    Reliability <SortIndicator active={sortKey === "reliability"} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`${BASE}/players/${encodeURIComponent(String(p.id))}`}
                      className="text-gray-100 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(p._trend)}`}>
                      {fmtNum(p._power, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TrendIcon t={p._trend} />
                  </td>
                  <td className="px-4 py-3">{p.wins ?? 0}</td>
                  <td className="px-4 py-3">{p.duels ?? 0}</td>
                  <td className="px-4 py-3">{fmtPct(p.winPct)}</td>
                  <td className="px-4 py-3">{fmtNum(p.clutch, 1)}</td>
                  <td className="px-4 py-3">{fmtNum(p.choke, 1)}</td>
                  <td className="px-4 py-3">{fmtNum(p.reliability, 2)}</td>
                </tr>
              ))}

              {roster.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-gray-300" colSpan={9}>
                    No players match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
