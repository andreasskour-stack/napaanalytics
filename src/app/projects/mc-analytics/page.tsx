// src/app/projects/mc-analytics/page.tsx
import Link from "next/link";

const BRAND = "text-[color:var(--napa-accent)]";

function SectionTitle({
  eyebrow,
  title,
  desc,
  right,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {desc ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
            {desc}
          </p>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
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
      {title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-gray-400">{subtitle}</div>
            ) : null}
          </div>
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
            Placeholder
          </span>
        </div>
      ) : null}
      {children ? <div className={title ? "mt-5" : ""}>{children}</div> : null}
    </div>
  );
}

function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-sm text-gray-400">{hint}</div> : null}
    </div>
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

function MiniHistogram() {
  // purely decorative placeholder – no random values (SSR-safe)
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
      {/* frontier curve */}
      <path
        d="M80,205 C160,180 220,150 280,125 C340,102 400,92 460,80 C520,70 565,60 590,52"
        fill="none"
        stroke="rgba(63,182,198,0.85)"
        strokeWidth="3"
      />
      {/* points */}
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
      {children}
    </span>
  );
}

export default function MCAnalyticsComingSoonPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionTitle
        eyebrow="Projects"
        title="MC Portfolio Analytics"
        desc="Institutional-style Monte Carlo portfolio simulation and risk reporting — designed in the same Napa / SurvivorStats visual language, inspired by Portfolio Visualizer."
        right={
          <>
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              ← Napa Home
            </Link>
            <Link
              href="/projects/survivor-stats"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              SurvivorStats
            </Link>
          </>
        }
      />

      {/* Status */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-xl border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200">
          Coming soon
        </span>
        <Pill>Monte Carlo • Risk Metrics • Efficient Frontier</Pill>
        <Pill>Portfolio Visualizer-inspired layout</Pill>
        <Pill>
          Brand accent: <span className={`ml-1 ${BRAND}`}>--napa-accent</span>
        </Pill>
      </div>

      {/* Config bar */}
      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-white">Simulation configuration (preview)</div>
          <div className="flex flex-wrap gap-2">
            <Pill>Horizon: 1Y</Pill>
            <Pill>Step: Weekly</Pill>
            <Pill>Runs: 10,000</Pill>
            <Pill>Confidence: 95%</Pill>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <KPI label="Expected return (μ)" value="8.4%" hint="Portfolio mean (placeholder)" />
        <KPI label="Volatility (σ)" value="12.7%" hint="Std dev (placeholder)" />
        <KPI label="VaR (95%)" value="-6.1%" hint="1Y VaR (placeholder)" />
        <KPI label="CVaR (95%)" value="-9.8%" hint="Tail loss (placeholder)" />
      </div>

      {/* Main grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card title="Return distribution (1Y)" subtitle="Histogram + VaR markers (placeholder)">
          <MiniHistogram />
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill>Mean</Pill>
            <Pill>Median</Pill>
            <Pill>VaR</Pill>
            <Pill>CVaR</Pill>
          </div>
        </Card>

        <Card title="Efficient frontier" subtitle="Risk vs return with key portfolios (placeholder)">
          <MiniFrontier />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Max Sharpe</div>
              <div className="mt-1 text-lg font-semibold text-white">1.02</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Min Vol</div>
              <div className="mt-1 text-lg font-semibold text-white">9.8%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Target Return</div>
              <div className="mt-1 text-lg font-semibold text-white">10.0%</div>
            </div>
          </div>
        </Card>

        <Card title="Equity curve (simulated path)" subtitle="Preview style only (placeholder)" className="lg:col-span-2">
          <MiniLineChart />
          <div className="mt-2 text-xs text-gray-400">
            This preview shows the intended visual language. Later we’ll render real MC paths, percentiles, and benchmark overlays.
          </div>
        </Card>
      </div>

      {/* Tables (Portfolio Visualizer vibe) */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card title="Asset stats (preview)" subtitle="What you’ll expect once data is wired">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">μ</th>
                  <th className="px-4 py-3">σ</th>
                  <th className="px-4 py-3">Sharpe</th>
                  <th className="px-4 py-3">Weight</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {[
                  ["AAPL", "9.1%", "18.2%", "0.50", "18%"],
                  ["MSFT", "8.7%", "16.9%", "0.52", "22%"],
                  ["GOOGL", "7.9%", "19.4%", "0.41", "15%"],
                  ["SPY", "6.5%", "12.4%", "0.52", "45%"],
                ].map((r) => (
                  <tr key={r[0]} className="border-t border-white/10">
                    <td className="px-4 py-3 font-semibold text-white">{r[0]}</td>
                    <td className="px-4 py-3">{r[1]}</td>
                    <td className="px-4 py-3">{r[2]}</td>
                    <td className="px-4 py-3">{r[3]}</td>
                    <td className="px-4 py-3">{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Allocation (preview)" subtitle="Weights + constraints summary (placeholder)">
          <div className="grid gap-3">
            {[
              ["MSFT", 22],
              ["AAPL", 18],
              ["GOOGL", 15],
              ["SPY", 45],
            ].map(([name, w]) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{name}</div>
                  <div className="text-sm text-gray-200">{w}%</div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${w}%`,
                      background: "rgba(63,182,198,0.65)",
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Constraints</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>Max weight: 25%</Pill>
                <Pill>Min weight: 0%</Pill>
                <Pill>Cash: 0%</Pill>
                <Pill>Rebalance: Monthly</Pill>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Methodology block */}
      <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
          Methodology (preview)
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Built for portfolio decisions
        </h2>
        <p className="mt-4 max-w-4xl text-sm leading-relaxed text-gray-300 md:text-base">
          MC Analytics will focus on distribution-aware forecasting, risk metrics (VaR/CVaR),
          portfolio construction, and clear reporting. The UI is intentionally minimal:
          large KPIs, clean tables, and accent color only where it carries meaning.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Pill>Forecast distributions</Pill>
          <Pill>Stress scenarios</Pill>
          <Pill>Efficient frontier</Pill>
          <Pill>Risk contribution</Pill>
          <Pill>Backtest overlays</Pill>
        </div>

        <div className="mt-6 text-xs text-gray-400">
          Next step when you’re ready: wire this page to your MC outputs (CSV/JSON) and swap placeholders for real charts.
        </div>
      </div>
    </div>
  );
}
