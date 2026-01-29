"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";
import episodesRaw from "@/data/episodes.json";

const BASE = "/projects/survivor-stats";

type AnyRow = Record<string, any>;
const EPISODES = episodesRaw as AnyRow[];

function fmtDelta(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

/**
 * Safety net:
 * If label accidentally contains "Episode X — Something", show only "Something".
 * If it contains "Episode X - Something" (dash variant), also handle it.
 */
function cleanLabel(label: any): string {
  const s = String(label ?? "").trim();
  if (!s) return "";
  return s
    .replace(/^Episode\s*\d+\s*[—-]\s*/i, "") // "Episode 9 — " or "Episode 9 - "
    .trim();
}

function fmtDateISO(v: any): string {
  if (!v) return "—";
  try {
    return new Date(String(v)).toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
}

export default function EpisodesIndexPage() {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EPISODES
      .slice()
      .filter((e) => {
        if (!q) return true;
        const hay = JSON.stringify(e).toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => String(b?.dateISO ?? "").localeCompare(String(a?.dateISO ?? "")));
  }, [query]);

  return (
    <>
      <PageHeader
        title="Episodes"
        subtitle="Episode summaries + movers."
        right={
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search episodes…"
            className="w-52 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
          />
        }
      />

      <div className="space-y-3">
        {rows.map((e) => {
          const date = fmtDateISO(e.dateISO);
          const rise = e?.summary?.biggestRise ?? null;
          const fall = e?.summary?.biggestFall ?? null;

          // Prefer clean label; fallback to something safe
          const label = cleanLabel(e?.label) || `Episode ${e?.episode ?? e?.id ?? "?"}`;

          return (
            <Link
              key={e.id}
              href={`${BASE}/episodes/${encodeURIComponent(String(e.id))}`}
              className="block"
            >
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-gray-100">{label}</div>
                    <div className="mt-1 text-sm text-gray-400">
                      Date: <span className="text-gray-200">{date}</span> • Compared players:{" "}
                      <span className="text-gray-200">{e?.summary?.comparedPlayers ?? "—"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-xs text-gray-400">Biggest rise</div>
                      <div className="font-semibold text-gray-100">
                        {rise ? `${rise.name}` : "—"}{" "}
                        <span className="text-green-300">{rise ? fmtDelta(rise.delta) : ""}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-xs text-gray-400">Biggest fall</div>
                      <div className="font-semibold text-gray-100">
                        {fall ? `${fall.name}` : "—"}{" "}
                        <span className="text-red-300">{fall ? fmtDelta(fall.delta) : ""}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-300">Open movers →</div>
              </div>
            </Link>
          );
        })}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
            No episodes match your search.
          </div>
        ) : null}
      </div>
    </>
  );
}
