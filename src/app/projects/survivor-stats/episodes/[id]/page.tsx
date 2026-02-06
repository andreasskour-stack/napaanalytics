import Link from "next/link";
import episodesRaw from "@/data/episodes.json";

type AnyRow = Record<string, any>;
const EPISODES = episodesRaw as AnyRow[];

const BASE = "/projects/survivor-stats";

function getEpisodeId(e: AnyRow): string {
  return String(e?.id ?? e?.episodeId ?? e?.EpisodeID ?? "");
}

function cleanLabel(label: any): string {
  const s = String(label ?? "").trim();
  if (!s) return "";
  return s.replace(/^Episode\s*\d+\s*[—-]\s*/i, "").trim();
}

function getEpisodeLabel(e: AnyRow): string {
  const raw = String(e?.label ?? e?.name ?? e?.title ?? "").trim();
  const cleaned = cleanLabel(raw);
  return cleaned || raw || `Episode ${getEpisodeId(e)}`;
}

function getEpisodeDate(e: AnyRow): string | null {
  const v = e?.dateISO ?? e?.date ?? null;
  if (!v) return null;
  try {
    return new Date(String(v)).toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
}

function asNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtDelta(v: any): string {
  const n = asNum(v);
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function deltaClass(v: any): string {
  const n = asNum(v);
  if (n == null) return "text-gray-300";
  if (n > 0) return "text-green-300";
  if (n < 0) return "text-red-300";
  return "text-gray-200";
}

function TeamChip({ team }: { team: string }) {
  const t = String(team || "").toLowerCase();

  const cls =
    t.includes("ath")
      ? "border-white/10 bg-red-500/10 text-red-200"
      : t.includes("epa")
      ? "border-white/10 bg-blue-500/10 text-blue-200"
      : "border-white/10 bg-white/5 text-gray-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>
      {team}
    </span>
  );
}

function MoverRow({ mover }: { mover: any }) {
  if (!mover) return <div className="text-sm text-gray-400">—</div>;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold text-gray-100">{mover.name ?? "—"}</div>
        <div className="text-xs text-gray-400">{mover.team ?? ""}</div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs text-gray-400">Δ</div>
        <div className={`font-semibold ${deltaClass(mover.delta)}`}>{fmtDelta(mover.delta)}</div>
      </div>
    </div>
  );
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

  // ✅ NEW: read real score from summary.teamResult (or ep.teamResult if you ever store it there)
  const teamResult = ep?.summary?.teamResult ?? ep?.teamResult ?? null;
  const winner = teamResult?.winner ?? "Pending";

  const ath = asNum(teamResult?.score?.Athinaioi);
  const epa = asNum(teamResult?.score?.Eparxiotes);
  const scoreText = ath != null && epa != null ? `${ath} - ${epa}` : "—";

  const margin =
    teamResult?.margin != null ? teamResult.margin : ath != null && epa != null ? Math.abs(ath - epa) : null;

  const rise = ep?.summary?.biggestRise ?? null;
  const fall = ep?.summary?.biggestFall ?? null;

  const riseByTeam = ep?.summary?.biggestRiseByTeam ?? {};
  const fallByTeam = ep?.summary?.biggestFallByTeam ?? {};

  const athRise = riseByTeam?.Athinaioi ?? null;
  const epaRise = riseByTeam?.Eparxiotes ?? null;
  const athFall = fallByTeam?.Athinaioi ?? null;
  const epaFall = fallByTeam?.Eparxiotes ?? null;

  return (
    <div className="space-y-6">
      <Link
        href={`${BASE}/episodes`}
        className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
      >
        ← Episodes
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-3xl font-semibold text-gray-100">{label}</div>
            <div className="mt-2 text-sm text-gray-300">
              Episode ID: <span className="text-gray-100">{id}</span>
              {date ? (
                <>
                  {" "}• Date: <span className="text-gray-100">{date}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Team result (REAL score from duels.csv) */}
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-400">Team result</div>
            <div className="mt-1 flex items-center gap-2">
              <TeamChip team={winner} />
              <div className="text-sm text-gray-300">
                Score: <span className="font-semibold text-gray-100">{scoreText}</span>
                {" "}• Margin: <span className="font-semibold text-gray-100">{margin ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Compared Players</div>
            <div className="mt-1 text-xl font-semibold text-gray-100">
              {ep?.summary?.comparedPlayers ?? "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Biggest Rise (Overall)
            </div>
            <div className="mt-2">
              <MoverRow mover={rise} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Biggest Fall (Overall)
            </div>
            <div className="mt-2">
              <MoverRow mover={fall} />
            </div>
          </div>
        </div>

        {/* Per-team biggest rise/fall */}
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-400">Athinaioi</div>
              <TeamChip team="Athinaioi" />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400">Biggest rise</div>
                <div className="mt-2">
                  <MoverRow mover={athRise} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400">Biggest fall</div>
                <div className="mt-2">
                  <MoverRow mover={athFall} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-gray-400">Eparxiotes</div>
              <TeamChip team="Eparxiotes" />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400">Biggest rise</div>
                <div className="mt-2">
                  <MoverRow mover={epaRise} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400">Biggest fall</div>
                <div className="mt-2">
                  <MoverRow mover={epaFall} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
          <span className="font-semibold text-gray-100">Note:</span> “Team result” is computed from duel-level
          data (RedWon / BlueWon) in duels.csv.
        </div>
      </div>
    </div>
  );
}
