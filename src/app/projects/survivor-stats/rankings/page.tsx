"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";
import rankingsRaw from "@/data/rankings.json";

const BASE = "/projects/survivor-stats";

type Trend = "up" | "down" | "flat";

type Row = {
  id: string;
  name: string;
  team: string;
  power: number;
  trend: Trend;

  eliminatedEpisode?: number | null;
  isEliminated?: boolean;
};

// ✅ Normalize incoming trend strings from JSON (e.g. "Up" -> "up")
function normalizeTrend(x: unknown): Trend {
  const t = String(x ?? "").trim().toLowerCase();
  if (t === "up") return "up";
  if (t === "down") return "down";
  return "flat";
}

// ✅ Normalize dataset once (so the rest of the UI can trust r.trend)
const DATA: Row[] = (rankingsRaw as any[]).map((r) => ({
  ...r,
  trend: normalizeTrend(r?.trend),
}));

function applyTeamGlow(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  const root = document.documentElement;

  const RED = "255, 59, 48";
  const BLUE = "20, 80, 255";
  const NEUTRAL = "120, 120, 120";

  if (t === "all") {
    root.style.setProperty("--glow-a", RED);
    root.style.setProperty("--glow-b", BLUE);
    root.style.setProperty("--glow-strength", "0.28");
    return;
  }

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

  root.style.setProperty("--glow-a", NEUTRAL);
  root.style.setProperty("--glow-b", NEUTRAL);
  root.style.setProperty("--glow-strength", "0.20");
}

function resetTeamGlowToDefault() {
  const root = document.documentElement;
  root.style.setProperty("--glow-a", "255, 59, 48");
  root.style.setProperty("--glow-b", "20, 80, 255");
  root.style.setProperty("--glow-strength", "0.28");
}

function TrendIcon({ t }: { t: Trend }) {
  if (t === "up") return <span className="text-green-400">▲</span>;
  if (t === "down") return <span className="text-red-400">▼</span>;
  return <span className="text-gray-400">•</span>;
}

function teamStyle(team: string) {
  const t = (team ?? "").trim().toLowerCase();

  if (t === "athinaioi") return "bg-red-500/20 border-red-400/40";
  if (t === "eparxiotes") return "bg-blue-500/20 border-blue-400/40";
  return "bg-white/5 border-white/10";
}

function powerBadgeStyle(trend: Trend) {
  if (trend === "up") return "bg-green-500 text-gray-950 border-green-300/70";
  if (trend === "down") return "bg-red-500 text-gray-950 border-red-300/70";
  return "bg-gray-950/30 text-gray-100 border-white/10";
}

function outBadge(elimEp?: number | null) {
  if (elimEp == null) return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gray-200">
      OUT · Ep {Math.round(elimEp)}
    </span>
  );
}

export default function RankingsPage() {
  const router = useRouter();
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    applyTeamGlow(teamFilter);
    return () => resetTeamGlowToDefault();
  }, [teamFilter]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const r of DATA) set.add(r.team);
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, []);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return DATA
      .filter((r) => (teamFilter === "All" ? true : r.team === teamFilter))
      .filter((r) => (qq ? r.name.toLowerCase().includes(qq) : true))
      .slice()
      .sort((a, b) => b.power - a.power);
  }, [teamFilter, q]);

  function goPlayer(id: string) {
    router.push(`${BASE}/players/${encodeURIComponent(id)}`);
  }

  return (
    <>
      <PageHeader
        title="Power Rankings"
        subtitle="Tap a row to open the player profile."
        right={
          <div className="flex flex-wrap gap-2">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none"
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
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

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-gray-300">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Power</th>
              <th className="px-4 py-3">Trend</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`cursor-pointer border-b border-white/5 hover:bg-white/5 ${
                  r.isEliminated ? "grayscale opacity-75" : ""
                }`}
                onClick={() => goPlayer(String(r.id))}
              >
                <td className="px-4 py-3 text-gray-300">{i + 1}</td>

                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`${BASE}/players/${encodeURIComponent(String(r.id))}`}
                    className="text-gray-100 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.name}
                    {outBadge(r.eliminatedEpisode ?? null)}
                  </Link>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${teamStyle(
                      r.team
                    )}`}
                  >
                    {r.team}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-sm font-semibold ${powerBadgeStyle(
                      r.trend
                    )}`}
                  >
                    {Math.round(r.power)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <TrendIcon t={r.trend} />
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-gray-300" colSpan={5}>
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
