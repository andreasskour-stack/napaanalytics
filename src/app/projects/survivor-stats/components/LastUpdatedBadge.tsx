import episodesRaw from "@/data/episodes.json";

type AnyRow = Record<string, any>;
const EPISODES = episodesRaw as AnyRow[];

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toISOString().slice(0, 10);
  } catch {
    return String(iso);
  }
}

function getEpisodeNum(e: AnyRow): number {
  const n = Number(e?.episode ?? e?.id ?? e?.EpisodeID ?? e?.episodeId ?? NaN);
  return Number.isFinite(n) ? n : -1;
}

export default function LastUpdatedBadge() {
  const latest =
    EPISODES
      ?.slice?.()
      ?.sort((a, b) => getEpisodeNum(b) - getEpisodeNum(a))?.[0] ?? null;

  if (!latest) return null;

  const epNum = getEpisodeNum(latest);
  const date = formatDate(latest?.dateISO);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
      <span className="opacity-70">Last updated</span>
      <span className="font-semibold text-gray-100">
        EP {epNum > 0 ? epNum : String(latest?.id ?? "—")}
      </span>
      {date ? <span className="opacity-70">• {date}</span> : null}
    </span>
  );
}
