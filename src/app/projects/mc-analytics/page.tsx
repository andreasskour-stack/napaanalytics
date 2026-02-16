// Destination: src/app/projects/mc-analytics/page.tsx
// File: page.tsx

import fs from "fs";
import path from "path";
import Link from "next/link";
import RunPickerClient, { type RunManifestLite } from "./RunPickerClient";

type Manifest = {
  run_id: string;
  timestamp: string;
  universe_size?: number;
  simulations?: number;
  horizon_years?: number;
  step?: string;
  confidence?: number;
};

type MetricValueJson = {
  kind: "metric_value";
  schema_version: number;
  run_id: string;
  generated_at: string;
  source_csv?: string;
  metrics: Record<string, number | string | boolean | null>;
  labels?: Record<string, string>;
};

type TableJson = {
  kind: "table";
  schema_version: number;
  run_id: string;
  generated_at: string;
  source_csv?: string;
  headers: string[];
  rows: Array<Record<string, any>>;
  id_column?: string;
  by_id?: Record<string, any>;
};

function readJsonIfExists<T>(p: string): T | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getMcDataRoot() {
  return path.join(process.cwd(), "src", "data", "mc");
}

function listRunsFromArchive(): Manifest[] {
  const root = getMcDataRoot();
  const archiveDir = path.join(root, "archive");
  if (!fs.existsSync(archiveDir)) return [];

  const dirs = fs
    .readdirSync(archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const manifests: Manifest[] = [];
  for (const dir of dirs) {
    const manifestPath = path.join(archiveDir, dir, "manifest.json");
    const m = readJsonIfExists<Manifest>(manifestPath);
    if (m?.run_id && m?.timestamp) manifests.push(m);
  }

  manifests.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return manifests;
}

function readLatestManifest(): Manifest | null {
  const root = getMcDataRoot();
  return readJsonIfExists<Manifest>(path.join(root, "latest", "manifest.json"));
}

// ---------- formatting ----------
function formatPct01(x: unknown): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function formatCurrency(x: unknown): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(x: unknown, maxDigits = 2): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
}

// Parse numeric value that may be number or numeric string
function parseNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x !== "string") return null;
  const s = x.trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Robust percent parsing: accepts 0.34, "0.34", "34%", "34 %", "34"
function parsePct01(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) {
    return x > 1 ? x / 100 : x;
  }
  if (typeof x !== "string") return null;

  const s = x.trim().replace(/,/g, "");
  if (!s) return null;

  const m = s.match(/^([+-]?\d+(\.\d+)?)\s*%$/);
  if (m) return Number(m[1]) / 100;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  return n > 1 ? n / 100 : n;
}

// ---------- robust metric lookup ----------
function pickMetricNumber(
  metrics: Record<string, any> | undefined,
  opts: { exact?: string[]; includesAny?: string[] }
): number | null {
  if (!metrics) return null;

  const exact = opts.exact ?? [];
  for (const k of exact) {
    const v = metrics[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }

  const includesAny = (opts.includesAny ?? []).map((s) => s.toLowerCase());
  if (includesAny.length) {
    const keys = Object.keys(metrics);
    for (const key of keys) {
      const kl = key.toLowerCase();
      if (includesAny.some((s) => kl.includes(s))) {
        const v = metrics[key];
        if (typeof v === "number" && Number.isFinite(v)) return v;
      }
    }
  }

  return null;
}

// ---------- table-field helpers ----------
function normalizeKey(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " pct ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Candidate-priority lookup:
 * - try candidates in order
 * - match against normalized keys
 * - return the first found value
 */
function pickRowField(row: Record<string, any>, candidatesNormalized: string[]): any {
  const normToActual = new Map<string, string>();
  for (const k of Object.keys(row)) {
    normToActual.set(normalizeKey(k), k);
  }

  for (const cand of candidatesNormalized) {
    const actual = normToActual.get(cand);
    if (actual != null) return row[actual];
  }

  return null;
}

// ---------- UI ----------
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/[0.03] p-6",
        "hover:border-white/20 hover:bg-white/[0.05] transition",
        "hover:shadow-[0_0_0_1px_rgba(63,182,198,0.18)]",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-gray-400">{subtitle}</div> : null}
        </div>
        {right ? right : <Pill>Placeholder</Pill>}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-sm text-gray-400">{hint}</div> : null}
    </div>
  );
}

function MiniHistogram() {
  const bars = [18, 32, 54, 72, 88, 76, 58, 40, 24, 14];
  return (
    <div className="flex h-44 items-end gap-2">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-full rounded-lg border border-white/10 bg-white/5"
          style={{ height: `${h}%` }}
          title="Placeholder"
        />
      ))}
    </div>
  );
}

function MiniFrontier() {
  return (
    <svg viewBox="0 0 640 260" className="h-52 w-full">
      <rect x="28" y="20" width="584" height="210" fill="transparent" stroke="rgba(255,255,255,0.12)" />
      <path
        d="M80,205 C160,180 220,150 280,125 C340,102 400,92 460,80 C520,70 565,60 590,52"
        fill="none"
        stroke="rgba(63,182,198,0.85)"
        strokeWidth="3"
      />
      <circle cx="270" cy="140" r="6" fill="rgba(255,255,255,0.85)" />
      <circle cx="470" cy="82" r="6" fill="rgba(255,255,255,0.85)" />
      <text x="270" y="162" fontSize="12" fill="rgba(255,255,255,0.65)">
        Current
      </text>
      <text x="470" y="104" fontSize="12" fill="rgba(255,255,255,0.65)">
        Max Sharpe
      </text>
      <text x="28" y="248" fontSize="12" fill="rgba(255,255,255,0.5)">
        Risk →
      </text>
      <text x="8" y="28" fontSize="12" fill="rgba(255,255,255,0.5)" transform="rotate(-90 8,28)">
        Return →
      </text>
    </svg>
  );
}

function MiniLineChart() {
  return (
    <svg viewBox="0 0 640 220" className="h-44 w-full">
      <defs>
        <linearGradient id="mc_fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
        </linearGradient>
      </defs>
      <path
        d="M20,170 C80,140 130,150 180,130 C230,110 270,135 320,105 C370,75 420,95 470,80 C520,65 560,70 620,48"
        fill="none"
        stroke="rgba(255,255,255,0.65)"
        strokeWidth="3"
      />
      <path
        d="M20,170 C80,140 130,150 180,130 C230,110 270,135 320,105 C370,75 420,95 470,80 C520,65 560,70 620,48 L620,206 L20,206 Z"
        fill="url(#mc_fill)"
      />
      <line x1="20" y1="206" x2="620" y2="206" stroke="rgba(255,255,255,0.12)" />
    </svg>
  );
}

// If archive has the file, use it. Otherwise fallback to latest.
function resolveDataPath(
  root: string,
  runId: string,
  filename: string
): { path: string; source: "archive" | "latest" } {
  const archivePath = path.join(root, "archive", runId, filename);
  if (fs.existsSync(archivePath)) return { path: archivePath, source: "archive" };
  return { path: path.join(root, "latest", filename), source: "latest" };
}

export default async function MCAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const requestedRun = typeof sp.run === "string" ? sp.run : undefined;

  const runs = listRunsFromArchive();
  const latest = readLatestManifest();

  const defaultRunId = latest?.run_id ?? (runs[0]?.run_id ?? "");
  const selectedRunId = requestedRun ?? defaultRunId;

  const root = getMcDataRoot();

  const selectedManifest =
    readJsonIfExists<Manifest>(path.join(root, "archive", selectedRunId, "manifest.json")) ??
    latest ??
    null;

  // -------- portfolio risk summary (KPIs) --------
  const prA = resolveDataPath(root, selectedRunId, "portfolio_risk_summary.json");
  const prB = resolveDataPath(root, selectedRunId, "Portfolio_Risk_Summary.json");
  const portfolioRiskSummary =
    readJsonIfExists<MetricValueJson>(prA.path) ?? readJsonIfExists<MetricValueJson>(prB.path) ?? null;
  const portfolioSource = portfolioRiskSummary
    ? readJsonIfExists<MetricValueJson>(prA.path)
      ? prA.source
      : prB.source
    : "latest";
  const metrics = portfolioRiskSummary?.metrics ?? undefined;

  const expectedCagr = pickMetricNumber(metrics, { exact: ["expected_cagr"], includesAny: ["expected_cagr", "cagr"] });
  const downsideProb = pickMetricNumber(metrics, {
    exact: ["downside_probability"],
    includesAny: ["downside_probability", "downside_prob"],
  });
  const median = pickMetricNumber(metrics, { exact: ["median_terminal", "portfolio_median"], includesAny: ["median"] });
  const p5 = pickMetricNumber(metrics, { exact: ["p5_terminal", "portfolio_p5"], includesAny: ["p5"] });
  const p95 = pickMetricNumber(metrics, { exact: ["p95_terminal", "portfolio_p95"], includesAny: ["p95"] });
  const lastValue = pickMetricNumber(metrics, {
    exact: ["portfolio_last_value"],
    includesAny: ["portfolio_last_value", "current_value", "last_value"],
  });
  const downsideVsCurrent = pickMetricNumber(metrics, {
    exact: ["downside_vs_current"],
    includesAny: ["downside_vs_current", "p5_vs_current"],
  });
  const upsideVsCurrent = pickMetricNumber(metrics, {
    exact: ["upside_vs_current"],
    includesAny: ["upside_vs_current", "p95_vs_current"],
  });

  // -------- risk metrics (asset table) --------
  const rmA = resolveDataPath(root, selectedRunId, "risk_metrics.json");
  const rmB = resolveDataPath(root, selectedRunId, "Risk_Metrics.json");
  const riskMetrics = readJsonIfExists<TableJson>(rmA.path) ?? readJsonIfExists<TableJson>(rmB.path) ?? null;
  const riskSource = riskMetrics ? (readJsonIfExists<TableJson>(rmA.path) ? rmA.source : rmB.source) : "latest";

  const riskRows = Array.isArray(riskMetrics?.rows) ? (riskMetrics!.rows as Array<Record<string, any>>) : [];

  const assets = riskRows
    .map((r, idx) => {
      // Your JSON uses StockName + StockID exactly.
      const display = pickRowField(r, ["stockname"]) ?? pickRowField(r, ["stockid"]) ?? "—";
      const stockId = pickRowField(r, ["stockid"]);

      const riskScore = parseNum(pickRowField(r, ["risk_score"]));

      // ✅ ONLY look for the real numeric downside column: "Downside Prob"
      // After you rename the other column to "Downside Prob Explanation",
      // it will no longer normalize to "downside_prob".
      const downside = parsePct01(pickRowField(r, ["downside_prob"]));

      const expectedLossRaw = pickRowField(r, ["expected_loss"]);
      const expectedLoss = parsePct01(expectedLossRaw) ?? parseNum(expectedLossRaw);

      const last = parseNum(pickRowField(r, ["lastprice"]));
      const p5a = parseNum(pickRowField(r, ["p5"]));
      const med = parseNum(pickRowField(r, ["median"]));

      return {
        rowKey: `${String(display)}__${String(stockId ?? "")}__${idx}`,
        display: String(display),
        stockId: stockId != null ? String(stockId) : null,
        riskScore,
        downside,
        expectedLoss,
        p5: p5a,
        median: med,
        last,
      };
    })
    .filter((a) => a.display !== "—");

  const assetsSorted = assets.slice().sort((a, b) => (b.riskScore ?? -Infinity) - (a.riskScore ?? -Infinity));
  const topAssets = assetsSorted.slice(0, 20);

  const pickerRuns: RunManifestLite[] = runs.map((m) => ({ run_id: m.run_id, timestamp: m.timestamp }));

  return (
    <div className="space-y-10">
      {/* Top intro row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-gray-400">MC Analytics</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Portfolio construction + risk reporting
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
            Latest run + historical run selection (file-based now, database-ready later).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pickerRuns.length ? <RunPickerClient runs={pickerRuns} selectedRunId={selectedRunId} /> : <Pill>No runs found</Pill>}
          <Link
            href="/#projects"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            Back to Projects →
          </Link>
        </div>
      </div>

      {/* Control bar */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-white">Simulation configuration</div>
          <div className="flex flex-wrap gap-2">
            <Pill>Run: {selectedManifest?.run_id ?? "—"}</Pill>
            <Pill>Horizon: {selectedManifest?.horizon_years ?? "—"}Y</Pill>
            <Pill>Step: {selectedManifest?.step ?? "—"}</Pill>
            <Pill>Runs: {selectedManifest?.simulations ?? "—"}</Pill>
            <Pill>Confidence: {selectedManifest?.confidence ?? "—"}</Pill>
            <Pill>Universe: {selectedManifest?.universe_size ?? "—"}</Pill>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-gray-400 md:flex-row md:items-center md:justify-between">
          <div>Timestamp: {selectedManifest?.timestamp ?? "—"}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>Portfolio KPIs: {portfolioSource}</Pill>
            <Pill>Risk table: {riskSource}</Pill>
            <Pill>Rows: {riskRows.length}</Pill>
          </div>
        </div>
      </div>

      {/* KPI rows */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Expected CAGR" value={formatPct01(expectedCagr)} hint="Portfolio_Risk_Summary" />
        <KPI label="Downside probability" value={formatPct01(downsideProb)} hint="P(term < current)" />
        <KPI label="P5 vs current" value={formatPct01(downsideVsCurrent)} hint="Downside vs current" />
        <KPI label="P95 vs current" value={formatPct01(upsideVsCurrent)} hint="Upside vs current" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Current value" value={formatCurrency(lastValue)} hint="Portfolio last value" />
        <KPI label="Median (terminal)" value={formatCurrency(median)} hint="Portfolio median" />
        <KPI label="P5 (terminal)" value={formatCurrency(p5)} hint="5th percentile" />
        <KPI label="P95 (terminal)" value={formatCurrency(p95)} hint="95th percentile" />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Return distribution (1Y)" subtitle="Histogram + tail markers (placeholder chart for now)">
          <div className="mt-1">
            <MiniHistogram />
          </div>
        </Card>

        <Card title="Efficient frontier" subtitle="Risk vs return (placeholder)">
          <MiniFrontier />
        </Card>

        {/* Risk table */}
        <Card
          title="Asset risk metrics"
          subtitle="Top 20 by Risk Score (bad-tail focus)"
          className="lg:col-span-2"
          right={<Pill>{assets.length ? `${assets.length} assets` : "No data"}</Pill>}
        >
          {topAssets.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/[0.04]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Risk score</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Downside Prob</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Expected loss</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Last</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">P5</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {topAssets.map((a) => (
                    <tr key={a.rowKey} className="border-t border-white/10">
                      <td className="px-4 py-3 font-semibold text-white">{a.display}</td>
                      <td className="px-4 py-3 text-gray-200">{a.riskScore != null ? formatNumber(a.riskScore, 3) : "—"}</td>
                      <td className="px-4 py-3 text-gray-200">{a.downside != null ? formatPct01(a.downside) : "—"}</td>
                      <td className="px-4 py-3 text-gray-200">{a.expectedLoss != null ? formatPct01(a.expectedLoss) : "—"}</td>
                      <td className="px-4 py-3 text-gray-200">{a.last != null ? formatCurrency(a.last) : "—"}</td>
                      <td className="px-4 py-3 text-gray-200">{a.p5 != null ? formatCurrency(a.p5) : "—"}</td>
                      <td className="px-4 py-3 text-gray-200">{a.median != null ? formatCurrency(a.median) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
              No risk metrics parsed from JSON.
            </div>
          )}
        </Card>

        <Card title="Equity curve (simulated path)" subtitle="Preview style only (placeholder)" className="lg:col-span-2">
          <MiniLineChart />
        </Card>
      </div>
    </div>
  );
}
