"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

export type RiskAssetRow = {
  rowKey: string;
  display: string; // StockName
  stockId: string | null; // not reliable for identity, ok to show in UI

  riskScore: number | null;
  downside: number | null; // 0..1
  expectedLoss: number | null; // negative decimal
  last: number | null;
  p5: number | null;
  median: number | null;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatPct01(x: unknown): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(clamp01(x) * 100).toFixed(2)}%`;
}

// ✅ Stable routing key: StockName slug from display
function slugifyName(name: unknown): string {
  const s = typeof name === "string" ? name : "";
  const clean = s
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "asset";
}

// Prevent "undefined"/empty routing keys
function safeDisplay(x: unknown): string {
  const s = typeof x === "string" ? x.trim() : "";
  if (!s) return "";
  const lo = s.toLowerCase();
  if (lo === "undefined" || lo === "null" || lo === "—") return "";
  return s;
}

// ✅ Deterministic formatting across SSR + client
const NF_CURR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
});
const NF_NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

function formatCurrency(x: unknown): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return NF_CURR.format(x);
}
function formatNumber(x: unknown, maxDigits = 3): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDigits }).format(x);
}

type SortKey = "display" | "riskScore" | "downside" | "expectedLoss" | "last" | "p5" | "median";
type SortDir = "asc" | "desc";

function cmpNullableNumber(a: number | null, b: number | null, dir: SortDir) {
  const aa = a ?? (dir === "asc" ? Infinity : -Infinity);
  const bb = b ?? (dir === "asc" ? Infinity : -Infinity);
  if (aa < bb) return dir === "asc" ? -1 : 1;
  if (aa > bb) return dir === "asc" ? 1 : -1;
  return 0;
}

function cmpString(a: string, b: string, dir: SortDir) {
  const aa = (a ?? "").toLowerCase();
  const bb = (b ?? "").toLowerCase();
  if (aa < bb) return dir === "asc" ? -1 : 1;
  if (aa > bb) return dir === "asc" ? 1 : -1;
  return 0;
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <th
      className={[
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300 select-none cursor-pointer",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
      onClick={() => onClick(sortKey)}
      title="Click to sort"
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {isActive ? (
          <span className="text-[rgb(63,182,198)]">{dir === "asc" ? "▲" : "▼"}</span>
        ) : (
          <span className="text-white/20">↕</span>
        )}
      </span>
    </th>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
      {children}
    </span>
  );
}

export default function RiskTableClient({
  rows,
  runId,
  subtitle = "Sortable • Search • Click a stock to open its dedicated asset page",
  limit = 20,
}: {
  rows: RiskAssetRow[];
  runId: string;
  subtitle?: string;
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [dir, setDir] = useState<SortDir>("desc");

  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  function handleSort(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "display" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const name = (r.display ?? "").toLowerCase();
      const id = (r.stockId ?? "").toLowerCase();
      return name.includes(needle) || id.includes(needle);
    });
  }, [rows, q]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    out.sort((a, b) => {
      switch (sortKey) {
        case "display":
          return cmpString(a.display, b.display, dir);
        case "riskScore":
          return cmpNullableNumber(a.riskScore, b.riskScore, dir);
        case "downside":
          return cmpNullableNumber(a.downside, b.downside, dir);
        case "expectedLoss":
          return cmpNullableNumber(a.expectedLoss, b.expectedLoss, dir);
        case "last":
          return cmpNullableNumber(a.last, b.last, dir);
        case "p5":
          return cmpNullableNumber(a.p5, b.p5, dir);
        case "median":
          return cmpNullableNumber(a.median, b.median, dir);
        default:
          return 0;
      }
    });
    return out;
  }, [filtered, sortKey, dir]);

  const shown = useMemo(() => {
    if (showAll) return sorted;
    return sorted.slice(0, limit);
  }, [sorted, showAll, limit]);

  const total = rows.length;
  const afterFilter = filtered.length;

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Asset risk metrics</div>
          <div className="mt-1 text-xs text-gray-400">{subtitle}</div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="text-xs text-gray-400">
            Sort: <span className="text-gray-200">{sortKey}</span>{" "}
            <span className="text-[rgb(63,182,198)]">{dir}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>
              Showing <span className="ml-1 text-gray-100">{shown.length}</span> /{" "}
              <span className="text-gray-100">{afterFilter}</span>
              <span className="ml-1 text-gray-400">(of {total})</span>
            </Pill>

            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              title={showAll ? "Show top list" : "Show all rows"}
            >
              {showAll ? `Show Top ${limit}` : "Show All"}
            </button>

            <button
              type="button"
              onClick={() => {
                setQ("");
                setSortKey("riskScore");
                setDir("desc");
                setShowAll(false);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              title="Reset search + sort"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stock name (preferred) or StockID…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-white/25"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
              title="Clear"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="text-xs text-gray-400">
          Tip: routing uses <span className="text-gray-200">StockName</span> (stable), not StockID.
        </div>
      </div>

      {/* Table */}
      {shown.length ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.04]">
              <tr>
                <SortTh label="Stock" sortKey="display" activeKey={sortKey} dir={dir} onClick={handleSort} />
                <SortTh
                  label="Risk score"
                  sortKey="riskScore"
                  activeKey={sortKey}
                  dir={dir}
                  onClick={handleSort}
                  align="right"
                />
                <SortTh
                  label="Downside Prob"
                  sortKey="downside"
                  activeKey={sortKey}
                  dir={dir}
                  onClick={handleSort}
                  align="right"
                />
                <SortTh
                  label="Expected loss"
                  sortKey="expectedLoss"
                  activeKey={sortKey}
                  dir={dir}
                  onClick={handleSort}
                  align="right"
                />
                <SortTh label="Last" sortKey="last" activeKey={sortKey} dir={dir} onClick={handleSort} align="right" />
                <SortTh label="P5" sortKey="p5" activeKey={sortKey} dir={dir} onClick={handleSort} align="right" />
                <SortTh
                  label="Median"
                  sortKey="median"
                  activeKey={sortKey}
                  dir={dir}
                  onClick={handleSort}
                  align="right"
                />
              </tr>
            </thead>

            <tbody>
              {shown.map((a) => {
                const display = safeDisplay(a.display);
                if (!display) return null;

                const slug = slugifyName(display);

                return (
                  <tr key={a.rowKey} className="border-t border-white/10">
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/projects/mc-analytics/assets/${encodeURIComponent(slug)}?run=${encodeURIComponent(runId)}`}
                        className="text-[rgb(63,182,198)] hover:text-[rgb(110,210,220)] transition"
                        title="Open asset page"
                      >
                        {display}
                      </Link>
                      {a.stockId ? <span className="ml-2 text-xs text-gray-500">#{a.stockId}</span> : null}
                    </td>

                    <td className="px-4 py-3 text-right text-gray-200">
                      {a.riskScore != null ? formatNumber(a.riskScore, 3) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      {a.downside != null ? formatPct01(a.downside) : "—"}
                    </td>

                    {/* expectedLoss is negative; keep sign */}
                    <td className="px-4 py-3 text-right text-gray-200">
                      {a.expectedLoss != null ? `${(a.expectedLoss * 100).toFixed(2)}%` : "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-gray-200">{a.last != null ? formatCurrency(a.last) : "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-200">{a.p5 != null ? formatCurrency(a.p5) : "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      {a.median != null ? formatCurrency(a.median) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
          No matches for your search.
        </div>
      )}
    </div>
  );
}
