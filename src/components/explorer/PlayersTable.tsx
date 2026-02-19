"use client";

import React from "react";
import Link from "next/link";
import type { PlayerAgg, SortDir, SortKey } from "@/lib/explorer/types";

const BASE = "/projects/survivor-stats";

function pct(x: number) {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function num(x: number | null | undefined, digits = 3) {
  if (x === null || x === undefined) return "—";
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function teamLabel(team: PlayerAgg["teamColor"]) {
  if (team === "Red") return "Athinaioi";
  if (team === "Blue") return "Eparxiotes";
  return "Unknown";
}

function teamClass(team: PlayerAgg["teamColor"]) {
  if (team === "Red") return "text-red-300 font-semibold";
  if (team === "Blue") return "text-blue-300 font-semibold";
  return "text-white/70";
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  const arrow = !active ? "" : sortDir === "asc" ? " ▲" : " ▼";

  return (
    <button
      onClick={() => onSort(col)}
      className={[
        "text-left font-semibold hover:text-white",
        active ? "text-white" : "text-white/80",
      ].join(" ")}
    >
      {label}
      {arrow}
    </button>
  );
}

export default function PlayersTable({
  rows,
  sortKey,
  sortDir,
  onSortChange,
}: {
  rows: PlayerAgg[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey, dir: SortDir) => void;
}) {
  const onSort = (k: SortKey) => {
    if (k !== sortKey) onSortChange(k, "desc");
    else onSortChange(k, sortDir === "desc" ? "asc" : "desc");
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
      <table className="min-w-[900px] w-full text-sm">

        <thead className="bg-black/20">
          <tr className="text-white/80">

            <th className="px-3 py-2">
              <SortHeader label="PlayerID" col="playerId" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="Name" col="playerName" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="Win%" col="winPct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="ArriveFirst%" col="arriveFirstPct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="TotalDuels" col="totalDuels" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="FinalPtsWon" col="finalPtsWon" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="Team" col="teamColor" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

            <th className="px-3 py-2">
              <SortHeader label="Dominance" col="normMargin" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </th>

          </tr>
        </thead>

        <tbody>

          {rows.map((r) => (

            <tr key={r.playerId} className="border-t border-white/10">

              <td className="px-3 py-2 text-white/90">
                {r.playerId ?? "—"}
              </td>

              {/* ✅ CLICKABLE NAME */}
              <td className="px-3 py-2">

                <Link
                  href={`${BASE}/players/${encodeURIComponent(String(r.playerId))}`}
                  className="text-teal-300 hover:underline font-semibold"
                >
                  {r.playerName ?? "—"}
                </Link>

              </td>

              <td className="px-3 py-2 text-white/90">
                {pct(r.winPct as any)}
              </td>

              <td className="px-3 py-2 text-white/90">
                {pct(r.arriveFirstPct as any)}
              </td>

              <td className="px-3 py-2 text-white/90">
                {r.totalDuels ?? "—"}
              </td>

              <td className="px-3 py-2 text-white/90">
                {r.finalPtsWon ?? "—"}
              </td>

              <td className={["px-3 py-2", teamClass(r.teamColor)].join(" ")}>
                {teamLabel(r.teamColor)}
              </td>

              <td className="px-3 py-2 text-white/90">
                {num(r.normMargin, 3)}
              </td>

            </tr>

          ))}

        </tbody>

      </table>
    </div>
  );
}
