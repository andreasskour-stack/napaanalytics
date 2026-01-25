import Link from "next/link";
import episodesRaw from "@/data/episodes.json";

type AnyRow = Record<string, any>;
const EPISODES = episodesRaw as AnyRow[];

const BASE = "/projects/survivor-stats";

function getEpisodeId(e: AnyRow): string {
  return String(e?.id ?? e?.episodeId ?? e?.EpisodeID ?? "");
}

function getEpisodeLabel(e: AnyRow): string {
  return String(e?.label ?? e?.name ?? e?.title ?? `Episode ${getEpisodeId(e)}`);
}

function getEpisodeDate(e: AnyRow): string | null {
  const v = e?.dateISO ?? e?.date ?? null;
  return v ? String(v) : null;
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = raw ? decodeURIComponent(raw) : "";

  const ep =
    EPISODES.find((e) => getEpisodeId(e) === id) ??
    EPISODES.find((e) => String(getEpisodeId(e)) === String(id));

  if (!ep) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xl font-semibold text-gray-100">Episode not found</div>
          <div className="mt-2 text-sm text-gray-300">
            No episode exists with id: <span className="text-gray-100">{id}</span>
          </div>
          <div className="mt-4">
            <Link
              href={`${BASE}/episodes`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              ← Back to Episodes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const label = getEpisodeLabel(ep);
  const date = getEpisodeDate(ep);

  return (
    <div className="space-y-6">
      <Link
        href={`${BASE}/episodes`}
        className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
      >
        ← Episodes
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-3xl font-semibold text-gray-100">{label}</div>
        <div className="mt-2 text-sm text-gray-300">
          Episode ID: <span className="text-gray-100">{id}</span>
          {date ? (
            <>
              {" "}• Date: <span className="text-gray-100">{date}</span>
            </>
          ) : null}
        </div>

        {/* Minimal: show summary cards (no raw JSON) */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Compared Players</div>
            <div className="mt-1 text-xl font-semibold text-gray-100">
              {ep?.summary?.comparedPlayers ?? "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Rise</div>
            <div className="mt-1 text-sm font-semibold text-gray-100">
              {ep?.summary?.biggestRise?.name ?? "—"}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Δ {ep?.summary?.biggestRise?.delta ?? "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Biggest Fall</div>
            <div className="mt-1 text-sm font-semibold text-gray-100">
              {ep?.summary?.biggestFall?.name ?? "—"}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Δ {ep?.summary?.biggestFall?.delta ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
