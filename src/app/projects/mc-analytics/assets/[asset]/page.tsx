// src/app/projects/mc-analytics/assets/[asset]/page.tsx

import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import React from "react";

type RiskAssetRow = {
  rowKey: string;
  display: string;
  stockId: string | null;

  riskScore: number | null;
  downside: number | null; // 0..1
  expectedLoss: number | null; // decimal (often negative)
  last: number | null;
  p5: number | null;
  median: number | null;
};

const NF_NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const NF_CURR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "symbol",
  maximumFractionDigits: 2,
});

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatPct01(x: unknown): string {
  if (!isFiniteNum(x)) return "—";
  return `${(clamp01(x) * 100).toFixed(2)}%`;
}

function formatNum(x: unknown): string {
  if (!isFiniteNum(x)) return "—";
  return NF_NUM.format(x);
}

function formatCurr(x: unknown): string {
  if (!isFiniteNum(x)) return "—";
  return NF_CURR.format(x);
}

function safeDecodeSegment(seg: unknown) {
  const s = typeof seg === "string" ? seg : "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function safeString(x: any): string {
  if (x == null) return "";
  const s = String(x).trim();
  if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
  return s;
}

// Must match RiskTableClient slug logic
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

// -------------------- CSV parsing (no deps) --------------------
function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < raw.length) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushField();
  pushRow();
  return rows;
}

function toNumberLoose(x: unknown): number | null {
  if (isFiniteNum(x)) return x;
  if (typeof x !== "string") return null;

  const s0 = x.trim();
  if (!s0) return null;

  let s = s0.replace(/\$/g, "").replace(/,/g, "").replace(/\s+/g, "");
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getCell(grid: string[][], r1: number, c1: number): string {
  const r = grid[r1 - 1];
  if (!r) return "";
  return (r[c1 - 1] ?? "").toString();
}

function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9&().,' -]/g, "")
    .trim();
}

// -------------------- Range bar UI --------------------
function RangeBar({
  p5,
  p95,
  median,
  last,
  labelLeft,
  labelRight,
}: {
  p5: number;
  p95: number;
  median?: number | null;
  last?: number | null;
  labelLeft?: string;
  labelRight?: string;
}) {
  const w = 260;
  const h = 52;
  const pad = 12;

  const min = Math.min(p5, p95);
  const max = Math.max(p5, p95);

  const xOf = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return pad + t * (w - pad * 2);
  };

  const x5 = xOf(p5);
  const x95 = xOf(p95);
  const xm = isFiniteNum(median) ? xOf(median) : null;
  const xl = isFiniteNum(last) ? xOf(last) : null;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Distribution range" className="block">
      <rect
        x={Math.min(x5, x95)}
        y={20}
        width={Math.max(2, Math.abs(x95 - x5))}
        height={12}
        rx={6}
        fill="currentColor"
        opacity="0.18"
      />
      <line x1={x5} y1={16} x2={x5} y2={36} stroke="currentColor" opacity="0.55" />
      <line x1={x95} y1={16} x2={x95} y2={36} stroke="currentColor" opacity="0.55" />

      {xm !== null ? (
        <>
          <line x1={xm} y1={14} x2={xm} y2={38} stroke="currentColor" opacity="0.9" />
          <text x={xm} y={49} fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.75">
            median
          </text>
        </>
      ) : null}

      {xl !== null ? (
        <>
          <circle cx={xl} cy={26} r={4} fill="currentColor" opacity="0.95" />
          <text x={xl} y={14} fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.75">
            last
          </text>
        </>
      ) : null}

      <text x={pad} y={12} fontSize="10" fill="currentColor" opacity="0.6">
        {labelLeft ?? `p5 ${formatNum(p5)}`}
      </text>
      <text x={w - pad} y={12} fontSize="10" textAnchor="end" fill="currentColor" opacity="0.6">
        {labelRight ?? `p95 ${formatNum(p95)}`}
      </text>
    </svg>
  );
}

// -------------------- FS helpers --------------------
async function readJsonFile<T>(absPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(absPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextFile(absPath: string): Promise<string | null> {
  try {
    return await fs.readFile(absPath, "utf-8");
  } catch {
    return null;
  }
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function getMcDataRoot() {
  return path.join(process.cwd(), "src", "data", "mc");
}

// Same behavior as mc-analytics/page.tsx: if archive missing, fallback to latest
async function resolveDataPath(
  runId: string,
  filename: string
): Promise<{ absPath: string; source: "archive" | "latest" }> {
  const root = getMcDataRoot();
  const archivePath = path.join(root, "archive", runId, filename);
  if (runId && runId !== "latest" && (await fileExists(archivePath))) {
    return { absPath: archivePath, source: "archive" };
  }
  return { absPath: path.join(root, "latest", filename), source: "latest" };
}

// -------------------- CSV extraction --------------------
type PortfolioHeaderMetrics = {
  drawdownThreshold: number | null; // B2
  severeDrawdown: number | null; // B3

  portfolioMedianReturnPct: number | null; // G2
  portfolioSD: number | null; // G3
  drawdownThresholdPct: number | null; // G4
  severeDrawdownPct: number | null; // G5

  portfolioMedianValue: number | null; // col 19
  portfolioP5Value: number | null;
  portfolioP95Value: number | null;
  portfolioSDValue: number | null;
  portfolioLastValue: number | null;
};

type PortfolioAssetRow = {
  stockName: string;
  weightPct: number | null;
  lastPrice: number | null;
  median: number | null;
  p5: number | null;
  p95: number | null;
  sd: number | null;
  downsideVsCurrent: number | null;
  upsideVsCurrent: number | null;
  riskAdjSpread: number | null;
};

function extractPortfolioCsv(grid: string[][]): { header: PortfolioHeaderMetrics; table: PortfolioAssetRow[] } {
  const drawdownThreshold = toNumberLoose(getCell(grid, 2, 2));
  const severeDrawdown = toNumberLoose(getCell(grid, 3, 2));

  const portfolioMedianReturnPct = toNumberLoose(getCell(grid, 2, 7));
  const portfolioSD = toNumberLoose(getCell(grid, 3, 7));
  const drawdownThresholdPct = toNumberLoose(getCell(grid, 4, 7));
  const severeDrawdownPct = toNumberLoose(getCell(grid, 5, 7));

  const portfolioMedianValue = toNumberLoose(getCell(grid, 1, 19));
  const portfolioP5Value = toNumberLoose(getCell(grid, 2, 19));
  const portfolioP95Value = toNumberLoose(getCell(grid, 3, 19));
  const portfolioSDValue = toNumberLoose(getCell(grid, 4, 19));
  const portfolioLastValue = toNumberLoose(getCell(grid, 5, 19));

  const header: PortfolioHeaderMetrics = {
    drawdownThreshold,
    severeDrawdown,
    portfolioMedianReturnPct,
    portfolioSD,
    drawdownThresholdPct,
    severeDrawdownPct,
    portfolioMedianValue,
    portfolioP5Value,
    portfolioP95Value,
    portfolioSDValue,
    portfolioLastValue,
  };

  // Table starts at A7; header row is row 7 => grid[6]
  const headerRow = grid[6] ?? [];
  const idx = (name: string) => headerRow.findIndex((h) => normName(h ?? "") === normName(name));

  const iStock = idx("Stock Name");
  const iWeight = idx("Weight");
  const iLast = idx("Lst Price");
  const iMedian = idx("Median");
  const iP5 = idx("P5");
  const iP95 = idx("P95");
  const iSD = idx("SD");
  const iDown = idx("Downside vs current");
  const iUp = idx("Upside vs current");
  const iRAS = idx("Risk-adjusted spread");

  const table: PortfolioAssetRow[] = [];

  for (let r = 7; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const stockName = (row[iStock] ?? "").toString().trim();
    if (!stockName) continue;

    table.push({
      stockName,
      weightPct: toNumberLoose(row[iWeight]),
      lastPrice: toNumberLoose(row[iLast]),
      median: toNumberLoose(row[iMedian]),
      p5: toNumberLoose(row[iP5]),
      p95: toNumberLoose(row[iP95]),
      sd: toNumberLoose(row[iSD]),
      downsideVsCurrent: toNumberLoose(row[iDown]),
      upsideVsCurrent: toNumberLoose(row[iUp]),
      riskAdjSpread: toNumberLoose(row[iRAS]),
    });
  }

  return { header, table };
}

function findBestAssetRow(table: PortfolioAssetRow[], display: string) {
  const target = normName(display);

  let hit = table.find((r) => normName(r.stockName) === target);
  if (hit) return hit;

  hit = table.find((r) => normName(r.stockName).includes(target) || target.includes(normName(r.stockName)));
  if (hit) return hit;

  const slug = slugifyName(display);
  hit = table.find((r) => slugifyName(r.stockName) === slug);
  if (hit) return hit;

  return null;
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  // ✅ Next.js 15: these are Promises in Server Components
  params: Promise<{ asset: string }>;
  searchParams?: Promise<{ run?: string }>;
}) {
  // ✅ FIX: await both
  const p = await params;
  const sp = (await searchParams) ?? {};

  const assetSeg = safeDecodeSegment(p?.asset);
  const requestedRun = sp?.run;

  const selectedRunId = requestedRun && typeof requestedRun === "string" ? requestedRun : "latest";

  const riskResolved = await resolveDataPath(selectedRunId, "risk_metrics.json");
  const csvResolved = await resolveDataPath(selectedRunId, "Portfolio_Distribution.csv");

  const risk = await readJsonFile<any>(riskResolved.absPath);
  const csvRaw = await readTextFile(csvResolved.absPath);

  const rawRows: Array<Record<string, any>> = Array.isArray(risk?.rows) ? risk.rows : [];

  const rows: RiskAssetRow[] = rawRows
    .map((r, idx) => {
      const display = safeString(r?.StockName) || safeString(r?.StockID);
      if (!display) return null;

      const stockId = safeString(r?.StockID) || null;

      return {
        rowKey: `${display}__${stockId ?? ""}__${idx}`,
        display,
        stockId,
        riskScore: typeof r?.["Risk Score"] === "number" ? r["Risk Score"] : null,
        downside: typeof r?.["Downside Prob"] === "number" ? r["Downside Prob"] : null,
        expectedLoss: typeof r?.["Expected Loss"] === "number" ? r["Expected Loss"] : null,
        last: typeof r?.LastPrice === "number" ? r.LastPrice : null,
        p5: typeof r?.P5 === "number" ? r.P5 : null,
        median: typeof r?.Median === "number" ? r.Median : null,
      };
    })
    .filter((x): x is RiskAssetRow => x !== null);

  const row =
    rows.find((r) => slugifyName(r.display) === assetSeg) ||
    rows.find((r) => r.display === assetSeg) ||
    null;

  if (!row) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <Link
            href={`/projects/mc-analytics?run=${encodeURIComponent(selectedRunId)}`}
            className="text-sm text-teal-300 hover:underline"
          >
            ← Back to Risk Table
          </Link>
        </div>

        <h1 className="text-2xl font-semibold">Asset not found</h1>
        <p className="mt-2 text-white/70">
          Couldn’t find an asset row for <span className="font-mono">{String(assetSeg)}</span> in run{" "}
          <span className="font-mono">{selectedRunId}</span>.
        </p>
        <p className="mt-3 text-xs text-white/50">
          Risk source used: <span className="font-mono">{riskResolved.source}</span> •{" "}
          <span className="font-mono">{riskResolved.absPath.replace(process.cwd(), "")}</span>
        </p>
      </div>
    );
  }

  const portfolio = typeof csvRaw === "string" && csvRaw.trim().length > 0 ? extractPortfolioCsv(parseCsv(csvRaw)) : null;

  const portfolioHeader = portfolio?.header ?? null;
  const portfolioTable = portfolio?.table ?? [];
  const assetFromCsv = portfolio ? findBestAssetRow(portfolioTable, row.display) : null;

  const hasPortfolioRange =
    isFiniteNum(portfolioHeader?.portfolioP5Value) &&
    isFiniteNum(portfolioHeader?.portfolioP95Value) &&
    isFiniteNum(portfolioHeader?.portfolioMedianValue);

  const hasAssetRange = isFiniteNum(assetFromCsv?.p5) && isFiniteNum(assetFromCsv?.p95) && isFiniteNum(assetFromCsv?.median);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/projects/mc-analytics?run=${encodeURIComponent(selectedRunId)}`}
          className="text-sm text-teal-300 hover:underline"
        >
          ← Back to Risk Table
        </Link>

        <div className="text-xs text-white/60">
          Run: <span className="font-mono text-white/75">{selectedRunId}</span>
          <span className="mx-2">•</span>
          Risk data: <span className="font-mono text-white/75">{riskResolved.source}</span>
        </div>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">{row.display}</h1>
      <div className="mt-2 text-sm text-white/60">
        Stock ID: <span className="font-mono text-white/75">{row.stockId ?? "—"}</span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Risk Score</div>
          <div className="mt-1 text-2xl font-semibold">{formatNum(row.riskScore)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Downside Prob</div>
          <div className="mt-1 text-2xl font-semibold">{formatPct01(row.downside)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Expected Loss</div>
          <div className="mt-1 text-2xl font-semibold">
            {row.expectedLoss != null ? `${(row.expectedLoss * 100).toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Portfolio distribution</div>
            <div className="mt-1 text-xs text-white/60">
              Source: <span className="font-mono">Portfolio_Distribution.csv</span>{" "}
              <span className="ml-2 text-white/50">(loaded from {csvResolved.source})</span>
            </div>
          </div>
        </div>

        {portfolioHeader && hasPortfolioRange ? (
          <div className="mt-5 flex items-center gap-5 text-white/80">
            <RangeBar
              p5={portfolioHeader.portfolioP5Value!}
              p95={portfolioHeader.portfolioP95Value!}
              median={portfolioHeader.portfolioMedianValue!}
              last={portfolioHeader.portfolioLastValue ?? null}
              labelLeft={`P5 ${formatCurr(portfolioHeader.portfolioP5Value!)}`}
              labelRight={`P95 ${formatCurr(portfolioHeader.portfolioP95Value!)}`}
            />
          </div>
        ) : (
          <div className="mt-4 text-sm text-white/60">
            Portfolio range data not found in the CSV header cells (expected P5/P95/Median/Last values).
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-medium">Asset distribution</div>

        {assetFromCsv && hasAssetRange ? (
          <div className="mt-4 flex items-center gap-5">
            <RangeBar
              p5={assetFromCsv.p5!}
              p95={assetFromCsv.p95!}
              median={assetFromCsv.median!}
              last={assetFromCsv.lastPrice ?? null}
              labelLeft={`P5 ${formatCurr(assetFromCsv.p5!)}`}
              labelRight={`P95 ${formatCurr(assetFromCsv.p95!)}`}
            />
            <div className="text-xs text-white/60">
              Matched CSV row: <span className="font-mono text-white/75">{assetFromCsv.stockName}</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-white/60">
            Couldn’t find a matching asset row in the CSV table for “{row.display}”.
          </div>
        )}
      </div>
    </div>
  );
}
