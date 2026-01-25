import Link from "next/link";
import episodesRaw from "@/data/episodes.json";

const BASE = "/projects/survivor-stats";

type Mover = {
  id: string;
  name: string;
  team: string;
  currPower: number;
  prevPower: number | null;
  delta: number | null;
};

type TeamSwingTeam = { sum: number; avg: number; n: number };

type TeamSwing = {
  teams: {
    Athinaioi: TeamSwingTeam;
    Eparxiotes: TeamSwingTeam;
    [key: string]: TeamSwingTeam;
  };
  winner: string;
  margin: number;
};

type Episode = {
  id: string;
  episode?: number; // ✅ optional
  label: string;
  dateISO: string;
  prevSnapshot: string;
  currSnapshot: string;
  summary: {
    comparedPlayers: number;
    biggestRise: Mover | null;
    biggestFall: Mover | null;
    teamSwing?: TeamSwing; // ✅ NEW SHAPE
  };
  movers: {
    up: Mover[];
    down: Mover[];
    byTeam: {
      Athinaioi?: { up: Mover[]; down: Mover[] };
      Eparxiotes?: { up: Mover[]; down: Mover[] };
      [key: string]: any;
    };
  };
};

const EPISODES = episodesRaw as Episode[];

function teamChipStyle(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  if (t === "athinaioi") return "bg-red-500/20 border-red-400/40 text-red-100";
  if (t === "eparxiotes") return "bg-blue-500/20 border-blue-400/40 text-blue-100";
  return "bg-white/5 border-white/10 text-gray-200";
}

function fmtDelta(d: number | null) {
  if (d == null || !Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(2)}`;
}

function fmtPower(p: number | null) {
  if (p == null || !Number.isFinite(p)) return "—";
  return p.toFixed(2);
}

function fmtSigned(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function HeadlineCard({
  title,
  mover,
  variant,
}: {
  title: string;
  mover: Mover | null;
  variant: "up" | "down";
}) {
  const isUp = variant === "up";
  const delta = mover?.delta ?? null;

  const badge =
    isUp
      ? "bg-green-500 text-gray-950 border-green-300/70"
      : "bg-red-500 text-gray-950 border-red-300/70";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>

      {!mover ? (
        <div className="mt-3 text-sm text-gray-300">No data yet.</div>
      ) : (
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`${BASE}/players/${encodeURIComponent(mover.id)}`}
              className="block truncate text-lg font-semibold text-gray-100 hover:underline"
            >
              {mover.name}
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${teamChipStyle(
                  mover.team
                )}`}
              >
                {mover.team}
              </span>

              <span className="text-sm text-gray-300">
                Power: <span className="text-gray-100">{fmtPower(mover.currPower)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className={`rounded-2xl border px-4 py-2 text-lg font-semibold ${badge}`}>
              {fmtDelta(delta)}
            </div>
            <div className="text-xs text-gray-400">vs last update</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoversList({ title, movers }: { title: string; movers: Mover[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-100">{title}</div>
        <div className="text-xs text-gray-400">Top 5</div>
      </div>

      <div className="mt-3 space-y-2">
        {movers.slice(0, 5).map((m) => (
          <Link
            key={m.id}
            href={`${BASE}/players/${encodeURIComponent(m.id)}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 hover:bg-white/5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-100">{m.name}</div>
              <div className="truncate text-xs text-gray-400">{m.team}</div>
            </div>
            <div className="text-sm font-semibold text-gray-100">{fmtDelta(m.delta)}</div>
          </Link>
        ))}

        {movers.length === 0 ? <div className="text-sm text-gray-300">No movers yet.</div> : null}
      </div>
    </div>
  );
}

function TeamSwingCard({ latest }: { latest: Episode }) {
  const swing = latest.summary.teamSwing;

  const ath = swing?.teams?.Athinaioi?.sum ?? null;
  const epa = swing?.teams?.Eparxiotes?.sum ?? null;

  const winner =
    swing?.winner ??
    (ath == null || epa == null ? "—" : ath === epa ? "Tie" : ath > epa ? "Athinaioi" : "Eparxiotes");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-xs uppercase tracking-wide text-gray-400">Team swing (net power change)</div>

      {!swing ? (
        <div className="mt-3 text-sm text-gray-300">
          Team swing not available yet — run <b>npm run episodes:build</b>.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Athinaioi</div>
            <div className="mt-1 text-2xl font-semibold text-gray-100">{fmtSigned(ath)}</div>
            <div className="mt-1 text-xs text-gray-400">Avg/player: {fmtSigned(swing.teams.Athinaioi?.avg)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Eparxiotes</div>
            <div className="mt-1 text-2xl font-semibold text-gray-100">{fmtSigned(epa)}</div>
            <div className="mt-1 text-xs text-gray-400">Avg/player: {fmtSigned(swing.teams.Eparxiotes?.avg)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Winner</div>
            <div className="mt-1 text-2xl font-semibold text-gray-100">{winner}</div>
            <div className="mt-1 text-xs text-gray-400">Margin: {fmtSigned(swing.margin)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const latest = EPISODES?.[0] ?? null;

  if (!latest) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-semibold text-gray-100">Survivor Greece Stats</div>
          <div className="mt-2 text-sm text-gray-300">
            No updates yet. Run your first publish (rankings + episodes) to populate the homepage.
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              href={`${BASE}/rankings`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              View Rankings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dateLabel = latest.dateISO.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-300">Survivor Greece</div>
            <div className="mt-1 text-3xl font-semibold text-gray-100">Stats Hub</div>
            <div className="mt-2 text-sm text-gray-300">
              Latest update: <span className="text-gray-100">{dateLabel}</span> •{" "}
              <span className="text-gray-100">{latest.label}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`${BASE}/episodes/${encodeURIComponent(latest.id)}`}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200"
            >
              View Update →
            </Link>
            <Link
              href={`${BASE}/rankings`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              Rankings
            </Link>
            <Link
              href={`${BASE}/players`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              Players
            </Link>
          </div>
        </div>
      </div>

      {/* HEADLINES */}
      <div className="grid gap-4 md:grid-cols-2">
        <HeadlineCard title="This week’s biggest riser" mover={latest.summary.biggestRise} variant="up" />
        <HeadlineCard title="This week’s biggest faller" mover={latest.summary.biggestFall} variant="down" />
      </div>

      {/* TEAM SWING */}
      <TeamSwingCard latest={latest} />

      {/* EXTRA: top 5 lists */}
      <div className="grid gap-4 md:grid-cols-2">
        <MoversList title="Top risers" movers={latest.movers.up} />
        <MoversList title="Top fallers" movers={latest.movers.down} />
      </div>
    </div>
  );
}
