"use client";

import { useMemo, useState } from "react";
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
  wins?: number;
  duels?: number;
  winPct?: number | null;
  clutch?: number | null;
  choke?: number | null;
  reliability?: number | null;
  power?: number | null;
};

type RankingRow = {
  id: string;
  name: string;
  team: string;
  power: number;
  trend: Trend;
};

const PLAYERS: PlayerRow[] = playersRaw as PlayerRow[];
const RANKINGS: RankingRow[] = rankingsRaw as RankingRow[];

function TrendIcon({ t }: { t: Trend }) {
  if (t === "up") return <span className="text-green-400">▲</span>;
  if (t === "down") return <span className="text-red-400">▼</span>;
  return <span className="text-gray-400">•</span>;
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

function fmtNum(x: number | null | undefined, digits = 0) {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

export default function PlayersIndexPage() {
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [q, setQ] = useState("");

  const rankById = useMemo(() => {
    const m = new Map<string, RankingRow>();
    for (const r of RANKINGS) m.set(String(r.id), r);
    return m;
  }, []);

  const teams = useMemo(() => {
    const uniq = Array.from(new Set(PLAYERS.map((p) => p.team).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b)
    );
    return ["All", ...uniq];
  }, []);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return PLAYERS
      .map((p) => {
        const r = rankById.get(String(p.id));
        const power = r?.power ?? (typeof p.power === "number" ? p.power : null);
        const trend = (r?.trend ?? "flat") as Trend;
        return {
          ...p,
          _power: power,
          _trend: trend,
        };
      })
      .filter((p) => (teamFilter === "All" ? true : (p.team ?? "") === teamFilter))
      .filter((p) => (qq ? (p.name ?? "").toLowerCase().includes(qq) : true))
      .slice()
      .sort((a, b) => {
        const ap = typeof a._power === "number" ? a._power : -Infinity;
        const bp = typeof b._power === "number" ? b._power : -Infinity;
        return bp - ap;
      });
  }, [q, teamFilter, rankById]);

  return (
    <>
      <PageHeader
        title="Players"
        subtitle="Browse all players. Tap a player to open their profile."
        right={
          <div className="flex flex-wrap gap-2">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none"
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t === "All" ? "All Teams" : t}
                </option>
              ))}
            </select>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search player…"
              className="w-44 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
            />
          </div>
        }
      />

      {/* MOBILE: Cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((p) => (
          <Link
            key={p.id}
            href={`${BASE}/players/${encodeURIComponent(String(p.id))}`}
            className="block"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-gray-100">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${teamBadgeStyle(
                        p.team
                      )}`}
                    >
                      {p.team}
                    </span>
                    <span className="text-xs text-gray-400">Wins: {p.wins ?? 0}</span>
                    <span className="text-xs text-gray-400">Duels: {p.duels ?? 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                      p._trend
                    )}`}
                  >
                    {p._power == null ? "—" : fmtNum(p._power, 0)}
                  </span>
                  <div className="text-lg leading-none">
                    <TrendIcon t={p._trend} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
            No players match your filters.
          </div>
        ) : null}
      </div>

      {/* DESKTOP: Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-gray-300">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Power</th>
              <th className="px-4 py-3">Trend</th>
              <th className="px-4 py-3">Win %</th>
              <th className="px-4 py-3">Wins</th>
              <th className="px-4 py-3">Duels</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => (
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
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${teamBadgeStyle(
                      p.team
                    )}`}
                  >
                    {p.team}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                      p._trend
                    )}`}
                  >
                    {p._power == null ? "—" : fmtNum(p._power, 0)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <TrendIcon t={p._trend} />
                </td>

                <td className="px-4 py-3">{fmtPct(p.winPct ?? null)}</td>
                <td className="px-4 py-3">{p.wins ?? 0}</td>
                <td className="px-4 py-3">{p.duels ?? 0}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-gray-300" colSpan={7}>
                  No players match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
