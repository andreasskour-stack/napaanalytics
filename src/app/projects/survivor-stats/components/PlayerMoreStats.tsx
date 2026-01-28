"use client";

import { useState } from "react";

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtInt(v: any): string {
  const n = toNum(v);
  if (n == null) return "—";
  return String(Math.round(n));
}
function fmtNum(v: any, digits = 2): string {
  const n = toNum(v);
  if (n == null) return "—";
  return n.toFixed(digits);
}
function fmtPct(v: any, digits = 1): string {
  const n = toNum(v);
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`.replace(/\.0%$/, "%");
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}

export default function PlayerMoreStats({
  arriveFirstPct,
  finalPtsPlayed,
  finalPtsWon,
  tiebreakPlayed,
  tiebreakWon,
  tiebreakWinPct,
  chokeRateWhenArrivedFirst,
  clutchRating,
  reliability,

  // New (optional)
  sos,
  pressureWeightedSos,
  closeLossRate,
  pressureWinPct,
  marginVolatility,
  rollingWinPct5,
  rollingWinPct8,
}: {
  arriveFirstPct: any;
  finalPtsPlayed: any;
  finalPtsWon: any;
  tiebreakPlayed: any;
  tiebreakWon: any;
  tiebreakWinPct: any;
  chokeRateWhenArrivedFirst: any;
  clutchRating: any;
  reliability: any;

  sos?: any;
  pressureWeightedSos?: any;
  closeLossRate?: any;
  pressureWinPct?: any;
  marginVolatility?: any;
  rollingWinPct5?: any;
  rollingWinPct8?: any;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-100">More stats</div>
          <div className="mt-1 text-xs text-gray-400">Advanced metrics</div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard label="Arrive first %" value={fmtPct(arriveFirstPct, 2)} />

          <StatCard
            label="Final points"
            value={`${fmtInt(finalPtsWon)} / ${fmtInt(finalPtsPlayed)}`}
            sub="Won / Played"
          />

          <StatCard
            label="Tie breaks"
            value={`${fmtInt(tiebreakWon)} / ${fmtInt(tiebreakPlayed)}`}
            sub={`Win%: ${fmtPct(tiebreakWinPct, 2)}`}
          />

          <StatCard
            label="Choke rate (when arrived first)"
            value={fmtPct(chokeRateWhenArrivedFirst, 2)}
          />

          <StatCard label="Clutch rating" value={fmtNum(clutchRating, 2)} />

          <StatCard label="Reliability" value={fmtNum(reliability, 2)} />

          {/* Optional new stats (only show if present) */}
          {toNum(sos) != null ? (
            <StatCard label="Opponent difficulty (SoS)" value={fmtNum(sos, 2)} />
          ) : null}

          {toNum(pressureWeightedSos) != null ? (
            <StatCard
              label="Pressure-weighted SoS"
              value={fmtNum(pressureWeightedSos, 2)}
            />
          ) : null}

          {toNum(closeLossRate) != null ? (
            <StatCard label="Close-loss rate" value={fmtPct(closeLossRate, 2)} />
          ) : null}

          {toNum(pressureWinPct) != null ? (
            <StatCard label="Pressure Win %" value={fmtPct(pressureWinPct, 2)} />
          ) : null}

          {toNum(marginVolatility) != null ? (
            <StatCard label="Performance volatility" value={fmtNum(marginVolatility, 3)} />
          ) : null}

          {toNum(rollingWinPct5) != null ? (
            <StatCard label="Rolling Win % (last 5)" value={fmtPct(rollingWinPct5, 2)} />
          ) : null}

          {toNum(rollingWinPct8) != null ? (
            <StatCard label="Rolling Win % (last 8)" value={fmtPct(rollingWinPct8, 2)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
