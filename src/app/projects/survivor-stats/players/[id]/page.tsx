import Link from "next/link";
import playersRaw from "@/data/players.json";
import rankingsRaw from "@/data/rankings.json";
import PlayerMoreStats from "../../components/PlayerMoreStats";
import LastUpdatedBadge from "../../components/LastUpdatedBadge";

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
    <span
      className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${cls}`}
    >
      Trend: {label}
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-100">{value}</div>
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

  // Prefer latest snapshot power from rankings.json when available
  const power = ranking?.power ?? player?.power ?? player?.power_adj ?? player?.power_raw ?? null;
  const trend = (ranking?.trend ?? "flat") as Trend;

  const wins = player?.wins ?? 0;
  const duels = player?.duels ?? 0;
  const winPct = player?.winPct ?? null;

  // New stats from players.json (produced by csv_to_players_json.mjs)
  const arriveFirstPct = player?.arriveFirstPct ?? null;
  const finalPtsPlayed = player?.finalPtsPlayed ?? null;
  const finalPtsWon = player?.finalPtsWon ?? null;
  const tiebreakPlayed = player?.tiebreakPlayed ?? null;
  const tiebreakWon = player?.tiebreakWon ?? null;
  const tiebreakWinPct = player?.tiebreakWinPct ?? null;

  // Existing advanced stats already in players.json
  const chokeRateWhenArrivedFirst = player?.choke ?? null; // mapped in script
  const clutchRating = player?.clutch ?? null;
  const reliability = player?.reliability ?? null;

  return (
    <div className="space-y-6">
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
</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">{trendBadge(trend)}</div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">Power</div>
            <div className="mt-1 text-4xl font-semibold text-gray-100">
              {power == null ? "—" : fmtInt(power)}
            </div>
          </div>
        </div>

        {/* Core stats */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <StatCard label="Wins" value={fmtInt(wins)} />
          <StatCard label="Duels" value={fmtInt(duels)} />
          <StatCard label="Win %" value={fmtPct(winPct, 1)} />
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
      />
    </div>
  );
}
