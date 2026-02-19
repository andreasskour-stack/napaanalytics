// src/app/projects/survivor-stats/players/[id]/page.tsx

import Link from "next/link";
import playersRaw from "@/data/players.json";
import rankingsRaw from "@/data/rankings.json";
import PlayerMoreStats from "../../components/PlayerMoreStats";
import LastUpdatedBadge from "../../components/LastUpdatedBadge";

import fs from "fs";
import path from "path";

type AnyRow = Record<string, any>;

const BASE = "/projects/survivor-stats";
const PLAYERS = playersRaw as AnyRow[];
const RANKINGS = rankingsRaw as AnyRow[];

type Trend = "up" | "down" | "flat";

function getId(x: AnyRow): string {
  return String(x?.id ?? x?.playerId ?? x?.PlayerID ?? x?.PlayerId ?? "");
}
function getName(x: AnyRow): string {
  return String(x?.name ?? x?.player ?? x?.Player ?? x?.PlayerName ?? "Unknown");
}
function getTeam(x: AnyRow): string {
  return String(x?.team ?? x?.Team ?? "Unknown");
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtInt(v: any): string {
  const n = toNum(v);
  if (n == null) return "—";
  return String(Math.round(n));
}
function fmtPct(v: any, digits = 1): string {
  const n = toNum(v);
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`.replace(/\.0%$/, "%");
}

function trendBadge(trend: Trend) {
  const cls =
    trend === "up"
      ? "border-green-400/40 bg-green-500/20 text-green-100"
      : trend === "down"
      ? "border-red-400/40 bg-red-500/20 text-red-100"
      : "border-white/10 bg-white/5 text-gray-200";
  const label = trend === "up" ? "Up" : trend === "down" ? "Down" : "Flat";

  return (
    <span className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${cls}`}>
      Trend: {label}
    </span>
  );
}

function eliminatedBadge(elimEp: number | null) {
  if (elimEp == null) return null;
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
      Eliminated · Ep {Math.round(elimEp)}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-300">{sub}</div> : null}
    </div>
  );
}

// ---------- Trend helpers (Adjusted Power) ----------
function readJSONSafe(absPath: string): any | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function calcSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 3) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}

function Sparkline({
  values,
  width = 620,          // ✅ bigger
  height = 250,         // ✅ bigger
  strokeWidth = 3,      // ✅ thicker
  padX = 25,            // ✅ a bit more breathing room horizontally
  padY = 18,            // ✅ but still “zoomed”
  zoomY = 0.20,         // ✅ tighten vertical range by adding margin = span * zoomY
  colorClass = "text-white/85",
  episodeStart = 1,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  padX?: number;
  padY?: number;
  zoomY?: number;
  colorClass?: string;
  episodeStart?: number;
}) {
  if (!values || values.length < 2) {
    return <div className="text-xs text-white/50">Not enough episodes to show a trend line.</div>;
  }

  // Zoom in vertically a touch by adding margin around min/max
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawSpan = rawMax - rawMin || 1;

  const margin = rawSpan * Math.max(0, zoomY);
  const min = rawMin - margin;
  const max = rawMax + margin;
  const span = max - min || 1;

  const xOf = (i: number) => {
    const t = values.length === 1 ? 0.5 : i / (values.length - 1);
    return padX + t * (width - padX * 2);
  };
  const yOf = (v: number) => {
    const t = (v - min) / span; // 0..1
    return height - padY - t * (height - padY * 2);
  };

  let d = "";
  for (let i = 0; i < values.length; i++) {
    const x = xOf(i);
    const y = yOf(values[i]);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const up = last > first;

  // Tooltip via <title> on circles (simple + works everywhere)
  const epOf = (i: number) => episodeStart + i;

  return (
    <div className={colorClass}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {/* line */}
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          opacity="0.9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* points */}
        {values.map((v, i) => {
          const isLast = i === values.length - 1;
          const r = isLast ? 5 : 4;
          const cx = xOf(i);
          const cy = yOf(v);
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" opacity={isLast ? 0.95 : 0.5}>
              <title>{`EP${epOf(i)}: ${v.toFixed(2)}`}</title>
            </circle>
          );
        })}

        {/* x-axis labels */}
        <text x={padX} y={16} fontSize="11" fill="currentColor" opacity="0.65">
          EP{episodeStart}
        </text>
        <text
          x={width - padX}
          y={16}
          fontSize="11"
          textAnchor="end"
          fill="currentColor"
          opacity="0.65"
        >
          EP{episodeStart + values.length - 1}
        </text>

        {/* last value */}
        <text
          x={width - padX}
          y={height - 8}
          fontSize="11"
          textAnchor="end"
          fill="currentColor"
          opacity="0.8"
        >
          {up ? "↗" : "↘"} {last.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId ? decodeURIComponent(rawId) : "";

  const player = PLAYERS.find((p) => getId(p) === id);
  const ranking = RANKINGS.find((r) => getId(r) === id);

  if (!player) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xl font-semibold text-gray-100">Player not found</div>
          <div className="mt-2 text-sm text-gray-300">
            No player exists with id: <span className="text-gray-100">{String(id)}</span>
          </div>
          <div className="mt-4">
            <Link
              href={`${BASE}/players`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              ← Back to Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const name = getName(player);
  const team = getTeam(player);

  const power = ranking?.power ?? player?.power ?? player?.power_adj ?? player?.power_raw ?? null;
  const trend = (ranking?.trend ?? "flat") as Trend;

  const wins = player?.wins ?? 0;
  const duels = player?.duels ?? 0;
  const winPct = player?.winPct ?? null;

  // CSV stats
  const arriveFirstPct = player?.arriveFirstPct ?? null;
  const finalPtsPlayed = player?.finalPtsPlayed ?? null;
  const finalPtsWon = player?.finalPtsWon ?? null;
  const tiebreakPlayed = player?.tiebreakPlayed ?? null;
  const tiebreakWon = player?.tiebreakWon ?? null;
  const tiebreakWinPct = player?.tiebreakWinPct ?? null;

  const chokeRateWhenArrivedFirst = player?.choke ?? null;
  const clutchRating = player?.clutch ?? null;
  const reliability = player?.reliability ?? null;

  // Optional stats (if present in players.json)
  const sos = player?.sos ?? null;
  const pressureWeightedSos = player?.pressureWeightedSos ?? null;
  const closeLossRate = player?.closeLossRate ?? null;
  const pressureWinPct = player?.pressureWinPct ?? null;
  const marginVolatility = player?.marginVolatility ?? null;
  const rollingWinPct5 = player?.rollingWinPct5 ?? null;
  const rollingWinPct8 = player?.rollingWinPct8 ?? null;

  const eliminatedEpisode = toNum(player?.eliminatedEpisode) ?? null;
  const isEliminated = Boolean(player?.isEliminated ?? ranking?.isEliminated);

  // ---------- Adjusted Power Trend (reconstructed from snapshots) ----------
  const root = process.cwd();
  const episodesPath = path.join(root, "src", "data", "episodes.json");
  const archiveDir = path.join(root, "src", "data", "archive");

  const episodes = (readJSONSafe(episodesPath) ?? []) as AnyRow[];
  const maxEp = Math.max(
    0,
    ...episodes.map((e) => Number(e?.id)).filter((n) => Number.isFinite(n))
  );

  const seriesRaw: number[] = [];
  for (let ep = 1; ep <= maxEp; ep++) {
    const snapPath = path.join(archiveDir, `rankings_ep_${String(ep).padStart(3, "0")}.json`);
    const snap = readJSONSafe(snapPath);
    const rows: AnyRow[] = Array.isArray(snap?.rankings) ? snap.rankings : [];
    const row = rows.find((r) => String(r?.id ?? "") === String(id));
    const p = toNum(row?.power);
    if (p != null) seriesRaw.push(p);
  }

  // Scale to "adjusted" using current player's power_adj vs current snapshot power.
  const currentAdj = toNum(player?.power_adj);
  const currentRaw = seriesRaw.length ? seriesRaw[seriesRaw.length - 1] : null;
  const scale = currentAdj != null && currentRaw != null && currentRaw !== 0 ? currentAdj / currentRaw : null;

  const seriesAdj = scale != null ? seriesRaw.map((v) => v * scale) : seriesRaw.slice();

  const slopeAdj = calcSlope(seriesAdj);

  const slopeLabel =
    slopeAdj == null ? "—" : slopeAdj > 0.05 ? "Up" : slopeAdj < -0.05 ? "Down" : "Flat";

  const slopeClass =
    slopeLabel === "Up" ? "text-green-300" : slopeLabel === "Down" ? "text-red-300" : "text-gray-200";

  const slopeText = slopeAdj == null ? "—" : `${slopeAdj.toFixed(2)} / ep`;

  // ✅ Color chart based on slope
  const chartColorClass =
    slopeLabel === "Up" ? "text-green-300" : slopeLabel === "Down" ? "text-red-300" : "text-white/85";

  return (
    <div className={`space-y-6 ${isEliminated ? "grayscale opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`${BASE}/players`}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
        >
          ← Players
        </Link>

        <Link
          href={`${BASE}/rankings`}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
        >
          Power Rankings →
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-3xl font-semibold text-gray-100">{name}</div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-300">
              <span>
                ID: <span className="text-gray-100">{id}</span> • Team:{" "}
                <span className="text-gray-100">{team}</span>
              </span>

              <LastUpdatedBadge />
              {eliminatedBadge(eliminatedEpisode)}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">{trendBadge(trend)}</div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">Power</div>
            <div className="mt-1 text-4xl font-semibold text-gray-100">{power == null ? "—" : fmtInt(power)}</div>
          </div>
        </div>

        {/* Core stats */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <StatCard label="Wins" value={fmtInt(wins)} />
          <StatCard label="Duels" value={fmtInt(duels)} />
          <StatCard label="Win %" value={fmtPct(winPct, 1)} />
        </div>

        {/* Adjusted trend line */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Adjusted power trend</div>
              <div className="mt-1 text-sm text-gray-300">
                Overall slope: <span className={`font-semibold ${slopeClass}`}>{slopeText}</span>{" "}
                <span className="text-gray-500">•</span>{" "}
                <span className={`font-semibold ${slopeClass}`}>{slopeLabel}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Uses snapshot power over episodes, scaled to current adjusted power.
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-400">Episodes in series</div>
              <div className="text-sm font-semibold text-gray-100">{seriesAdj.length || "—"}</div>
            </div>
          </div>

          {/* ✅ Bigger chart + zoomY */}
          <div className="mt-4">
            <Sparkline
              values={seriesAdj}
              width={620}
              height={250}
              strokeWidth={3}
              zoomY={0.20}
              colorClass={chartColorClass}
              episodeStart={1}
            />
          </div>
        </div>
      </div>

      {/* Advanced stats toggle */}
      <PlayerMoreStats
        arriveFirstPct={arriveFirstPct}
        finalPtsPlayed={finalPtsPlayed}
        finalPtsWon={finalPtsWon}
        tiebreakPlayed={tiebreakPlayed}
        tiebreakWon={tiebreakWon}
        tiebreakWinPct={tiebreakWinPct}
        chokeRateWhenArrivedFirst={chokeRateWhenArrivedFirst}
        clutchRating={clutchRating}
        reliability={reliability}
        sos={sos}
        pressureWeightedSos={pressureWeightedSos}
        closeLossRate={closeLossRate}
        pressureWinPct={pressureWinPct}
        marginVolatility={marginVolatility}
        rollingWinPct5={rollingWinPct5}
        rollingWinPct8={rollingWinPct8}
      />
    </div>
  );
}
