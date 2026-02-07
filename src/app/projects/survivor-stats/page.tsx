import type React from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";

const BASE = "/projects/survivor-stats";

// ---------- Types ----------
type AnyRow = Record<string, any>;

type RankRow = {
  id: string;
  name: string;
  team: string;
  power: number;
  active?: boolean;
  isEliminated?: boolean;
};

type Snapshot = {
  meta?: { builtAtISO?: string; episode?: number };
  rankings?: RankRow[];
};

// ---------- Helpers ----------
function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function asNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtDelta(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function fmtPower(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtNum2(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function cleanLabel(label: any): string {
  const s = String(label ?? "").trim();
  if (!s) return "";
  return s.replace(/^Episode\s*\d+\s*[—-]\s*/i, "").trim();
}

function stdevSample(values: number[]) {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const varSum = values.reduce((acc, x) => acc + (x - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

function readJSON(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function safeReadJSON(p: string): any | null {
  try {
    if (!fs.existsSync(p)) return null;
    return readJSON(p);
  } catch {
    return null;
  }
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

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-1 text-xl font-semibold text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-sm text-gray-300">{sub}</div> : null}
    </div>
  );
}

function MiniRow({
  name,
  team,
  right,
  rightClass,
}: {
  name: string;
  team?: string;
  right: React.ReactNode;
  rightClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold text-gray-100">{name}</div>
        {team ? <div className="text-xs text-gray-400">{team}</div> : null}
      </div>
      <div className={`shrink-0 font-semibold ${rightClass ?? "text-gray-100"}`}>{right}</div>
    </div>
  );
}

function sortByEpisodeDesc(eps: AnyRow[]) {
  return eps
    .slice()
    .sort((a, b) => Number(b?.id ?? -1) - Number(a?.id ?? -1))
    .filter((e) => Number.isFinite(Number(e?.id)));
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const arr = values.slice().sort((a, b) => a - b);
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  const w = idx - lo;
  return arr[lo] * (1 - w) + arr[hi] * w;
}

// ---------- Main ----------
export default function SurvivorStatsHome() {
  const root = process.cwd();
  const episodesPath = path.join(root, "src", "data", "episodes.json");
  const archiveDir = path.join(root, "src", "data", "archive");

  const EPISODES: AnyRow[] = safeReadJSON(episodesPath) ?? [];
  const episodesSorted = sortByEpisodeDesc(EPISODES);

  const latestEpisode = episodesSorted[0] ?? null;
  const maxEp = latestEpisode ? Number(latestEpisode.id) : 0;

  if (!latestEpisode || !Number.isFinite(maxEp) || maxEp <= 0) {
    return (
      <>
        <PageHeader title="Survivor Greece Stats" subtitle="No episodes found yet." />
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
          episodes.json is empty. Run <span className="text-gray-100">npm run episodes:build</span>.
        </div>
      </>
    );
  }

  // Load snapshots
  const snap = (ep: number): Snapshot | null =>
    safeReadJSON(path.join(archiveDir, `rankings_ep_${pad3(ep)}.json`));

  const s1 = snap(1);
  const sPrev = snap(maxEp - 1);
  const sNow = snap(maxEp);
  const s3 = snap(Math.max(0, maxEp - 3));

  const nowRows: RankRow[] = (sNow?.rankings ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    team: String(r.team ?? ""),
    power: Number(r.power ?? 0),
    active: r.active ?? (r.isEliminated != null ? !r.isEliminated : undefined),
    isEliminated: r.isEliminated,
  }));

  const prevRows: RankRow[] = (sPrev?.rankings ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    team: String(r.team ?? ""),
    power: Number(r.power ?? 0),
  }));

  const mapById = (rows: RankRow[]) => {
    const m = new Map<string, RankRow>();
    for (const r of rows) m.set(r.id, r);
    return m;
  };

  const prevMap = mapById(prevRows);

  // Active logic
  const activeRows = nowRows.filter((r) => {
    if (typeof r.active === "boolean") return r.active;
    if (typeof r.isEliminated === "boolean") return !r.isEliminated;
    return true;
  });

  // Season at a glance
  const episodesPlayed = maxEp;
  const playersRemaining = activeRows.length;

  // 🥇 Current #1 Power
  const topCurrent = [...activeRows].sort((a, b) => b.power - a.power)[0] ?? null;

  // ⚠️ Danger zone bottom 3 + last ep delta
  const danger = [...activeRows]
    .sort((a, b) => a.power - b.power)
    .slice(0, 3)
    .map((r) => {
      const prev = prevMap.get(r.id);
      const d = prev ? r.power - prev.power : null;
      return { ...r, deltaLast: d };
    });

  // 📈/📉 Gain/loss since Episode 1
  const ep1Rows: RankRow[] = (s1?.rankings ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    team: String(r.team ?? ""),
    power: Number(r.power ?? 0),
  }));
  const ep1Map = mapById(ep1Rows);

  const gains = activeRows
    .map((r) => {
      const base = ep1Map.get(r.id);
      const delta = base ? r.power - base.power : null;
      return { ...r, deltaSince1: delta };
    })
    .filter((r) => r.deltaSince1 != null);

  const biggestGain =
    [...gains].sort((a, b) => (b.deltaSince1 ?? 0) - (a.deltaSince1 ?? 0))[0] ?? null;
  const biggestLoss =
    [...gains].sort((a, b) => (a.deltaSince1 ?? 0) - (b.deltaSince1 ?? 0))[0] ?? null;

  // 🔥/❄️ Momentum last 3 (net change ep_(max-3) -> ep_max)
  const s3Rows: RankRow[] = (s3?.rankings ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    team: String(r.team ?? ""),
    power: Number(r.power ?? 0),
  }));
  const s3Map = mapById(s3Rows);

  const momentum = activeRows
    .map((r) => {
      const base = s3Map.get(r.id);
      const delta3 = base ? r.power - base.power : null;
      return { ...r, delta3 };
    })
    .filter((r) => r.delta3 != null);

  const hottest3 = [...momentum].sort((a, b) => (b.delta3 ?? 0) - (a.delta3 ?? 0)).slice(0, 3);
  const coldest3 = [...momentum].sort((a, b) => (a.delta3 ?? 0) - (b.delta3 ?? 0)).slice(0, 3);

  // 🎯 Reliability (stdev across ep_1..ep_max)
  const powerSeries = new Map<string, { name: string; team: string; values: number[] }>();

  for (let ep = 1; ep <= maxEp; ep++) {
    const s = snap(ep);
    const rows: any[] = s?.rankings ?? [];
    for (const rr of rows) {
      const id = String(rr.id);
      const name = String(rr.name ?? "");
      const team = String(rr.team ?? "");
      const power = Number(rr.power ?? 0);

      if (!powerSeries.has(id)) powerSeries.set(id, { name, team, values: [] });
      powerSeries.get(id)!.values.push(power);
    }
  }

  const reliableCandidates = activeRows
    .map((r) => {
      const series = powerSeries.get(r.id);
      const values = series?.values ?? [];
      const sd = values.length >= 2 ? stdevSample(values) : null;
      return { ...r, stdev: sd, n: values.length };
    })
    .filter((r) => r.stdev != null && (r.n ?? 0) >= Math.min(5, maxEp));

  const mostReliable =
    [...reliableCandidates].sort((a, b) => (a.stdev ?? 0) - (b.stdev ?? 0))[0] ?? null;

  const mostUnreliable =
    [...reliableCandidates].sort((a, b) => (b.stdev ?? 0) - (a.stdev ?? 0))[0] ?? null;

  // 🌪️ Chaos
  function meanAbsDelta(epA: number, epB: number) {
    const A = snap(epA)?.rankings ?? [];
    const B = snap(epB)?.rankings ?? [];
    const aMap = new Map<string, number>();
    for (const r of A) aMap.set(String(r.id), Number(r.power ?? 0));

    const diffs: number[] = [];
    for (const r of B) {
      const id = String(r.id);
      const pB = Number(r.power ?? 0);
      const pA = aMap.get(id);
      if (pA == null) continue;
      diffs.push(Math.abs(pB - pA));
    }
    if (!diffs.length) return null;
    return diffs.reduce((x, y) => x + y, 0) / diffs.length;
  }

  const chaosSeries: { ep: number; val: number }[] = [];
  for (let ep = 2; ep <= maxEp; ep++) {
    const v = meanAbsDelta(ep - 1, ep);
    if (v != null && Number.isFinite(v)) chaosSeries.push({ ep, val: v });
  }

  const chaosSeasonMin = chaosSeries.length ? Math.min(...chaosSeries.map((x) => x.val)) : null;
  const chaosSeasonMax = chaosSeries.length ? Math.max(...chaosSeries.map((x) => x.val)) : null;

  const chaosLatest = chaosSeries.find((x) => x.ep === maxEp)?.val ?? null;

  const last3 = chaosSeries
    .filter((x) => x.ep >= Math.max(2, maxEp - 2))
    .map((x) => x.val);
  const chaosLast3Avg = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : null;

  const chaosRank =
    chaosLatest != null
      ? 1 +
        chaosSeries
          .slice()
          .sort((a, b) => b.val - a.val)
          .findIndex((x) => x.ep === maxEp)
      : null;

  const chaosVals = chaosSeries.map((x) => x.val);
  const p33 = percentile(chaosVals, 0.33);
  const p66 = percentile(chaosVals, 0.66);

  let chaosLabel: "LOW" | "MED" | "HIGH" | "—" = "—";
  if (chaosLatest != null && p33 != null && p66 != null) {
    chaosLabel = chaosLatest <= p33 ? "LOW" : chaosLatest >= p66 ? "HIGH" : "MED";
  }

  const latestLabel = cleanLabel(latestEpisode?.label) || `Episode ${maxEp}`;

  return (
    <>
      <PageHeader
        title="Survivor Greece Stats"
        subtitle="Season dashboard: momentum, leaders, reliability, danger, chaos."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${BASE}/episodes`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              Episodes →
            </Link>
            <Link
              href={`${BASE}/episodes/${encodeURIComponent(String(maxEp))}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              Open latest →
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard title="Episodes played" value={episodesPlayed} sub={`Latest: ${latestLabel}`} />
          <StatCard title="Players remaining" value={playersRemaining} />

          <StatCard
            title={`Chaos (Episode ${maxEp})`}
            value={
              <div className="flex items-baseline gap-3">
                <span>{chaosLatest == null ? "—" : chaosLatest.toFixed(2)}</span>

                <span
                  className={`rounded-full border border-white/10 px-2 py-0.5 text-xs ${
                    chaosLabel === "HIGH"
                      ? "bg-red-500/10 text-red-200"
                      : chaosLabel === "LOW"
                      ? "bg-blue-500/10 text-blue-200"
                      : chaosLabel === "MED"
                      ? "bg-white/5 text-gray-200"
                      : "bg-white/5 text-gray-400"
                  }`}
                >
                  {chaosLabel}
                </span>
              </div>
            }
            sub={
              <div className="text-sm text-gray-300">
                <div className="text-xs text-gray-400">
                  Avg |Δ power| from EP {maxEp - 1} → EP {maxEp}
                </div>
                <div>
                  Season range: <span className="text-gray-100">{fmtNum2(chaosSeasonMin)}</span> –{" "}
                  <span className="text-gray-100">{fmtNum2(chaosSeasonMax)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Last 3 avg: {fmtNum2(chaosLast3Avg)}
                  {chaosRank != null ? ` • Rank: ${chaosRank}/${chaosSeries.length}` : ""}
                </div>
              </div>
            }
          />

          <StatCard
            title="🥇 Current #1 Power"
            value={topCurrent ? topCurrent.name : "—"}
            sub={
              topCurrent ? (
                <>
                  <span className="text-gray-100">{fmtPower(topCurrent.power)}</span>{" "}
                  <span className="text-gray-400">•</span>{" "}
                  <span className="inline-flex align-middle">
                    <TeamChip team={topCurrent.team} />
                  </span>
                </>
              ) : null
            }
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-100">🔥 Momentum up (last 3)</div>
              <div className="text-xs text-gray-400">Net Δ → EP {maxEp}</div>
            </div>
            <div className="mt-4 space-y-3">
              {hottest3.length ? (
                hottest3.map((p) => (
                  <MiniRow
                    key={p.id}
                    name={p.name}
                    team={p.team}
                    right={fmtDelta(asNum(p.delta3))}
                    rightClass="text-green-300"
                  />
                ))
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-100">❄️ Momentum down (last 3)</div>
              <div className="text-xs text-gray-400">Net Δ → EP {maxEp}</div>
            </div>
            <div className="mt-4 space-y-3">
              {coldest3.length ? (
                coldest3.map((p) => (
                  <MiniRow
                    key={p.id}
                    name={p.name}
                    team={p.team}
                    right={fmtDelta(asNum(p.delta3))}
                    rightClass="text-red-300"
                  />
                ))
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold text-gray-100">📈 Biggest gain since EP1</div>
            <div className="mt-4">
              {biggestGain ? (
                <MiniRow
                  name={biggestGain.name}
                  team={biggestGain.team}
                  right={fmtDelta(asNum(biggestGain.deltaSince1))}
                  rightClass="text-green-300"
                />
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold text-gray-100">📉 Biggest loss since EP1</div>
            <div className="mt-4">
              {biggestLoss ? (
                <MiniRow
                  name={biggestLoss.name}
                  team={biggestLoss.team}
                  right={fmtDelta(asNum(biggestLoss.deltaSince1))}
                  rightClass="text-red-300"
                />
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>
          </div>

          {/* ✅ UPDATED CARD: Reliable + Unreliable */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold text-gray-100">🎯 Reliability</div>
            <div className="mt-1 text-xs text-gray-400">Stdev of power (lower = steadier)</div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Most reliable</div>
                <div className="mt-2">
                  {mostReliable ? (
                    <MiniRow
                      name={mostReliable.name}
                      team={mostReliable.team}
                      right={(mostReliable.stdev ?? 0).toFixed(2)}
                      rightClass="text-green-300"
                    />
                  ) : (
                    <div className="text-sm text-gray-400">—</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Most unreliable</div>
                <div className="mt-2">
                  {mostUnreliable ? (
                    <MiniRow
                      name={mostUnreliable.name}
                      team={mostUnreliable.team}
                      right={(mostUnreliable.stdev ?? 0).toFixed(2)}
                      rightClass="text-red-300"
                    />
                  ) : (
                    <div className="text-sm text-gray-400">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-gray-100">⚠️ Danger zone</div>
            <div className="text-xs text-gray-400">Bottom 3 active by current power</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {danger.length ? (
              danger.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-100">{p.name}</div>
                      <div className="mt-1 text-xs text-gray-400">{p.team}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Power</div>
                      <div className="font-semibold text-gray-100">{fmtPower(p.power)}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-300">
                    Last ep Δ:{" "}
                    <span
                      className={`font-semibold ${
                        (p.deltaLast ?? 0) > 0
                          ? "text-green-300"
                          : (p.deltaLast ?? 0) < 0
                          ? "text-red-300"
                          : "text-gray-200"
                      }`}
                    >
                      {fmtDelta(p.deltaLast)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">—</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
