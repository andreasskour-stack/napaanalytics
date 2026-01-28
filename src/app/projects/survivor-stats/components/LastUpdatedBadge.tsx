import episodesRaw from "@/data/episodes.json";

type Episode = {
  episode: number;
  label?: string;
  dateISO?: string;
};

const EPISODES = episodesRaw as Episode[];

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LastUpdatedBadge() {
  if (!EPISODES.length) return null;

  // build_episodes.mjs writes newest first
  const latest = EPISODES[0];

  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
      <span className="font-semibold text-gray-100">
        Updated: Episode {latest.episode}
      </span>
      {latest.dateISO ? <span>· {formatDate(latest.dateISO)}</span> : null}
    </span>
  );
}
