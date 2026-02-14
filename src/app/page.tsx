// src/app/page.tsx
import Link from "next/link";
import Image from "next/image";

const SURVIVOR = "/projects/survivor-stats";
const MC = "/projects/mc-analytics";

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-sm text-gray-400">{sub}</div> : null}
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "live" | "soon" | "neutral";
}) {
  const cls =
    tone === "live"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
      : tone === "soon"
      ? "border-amber-400/30 bg-amber-400/15 text-amber-200"
      : "border-white/10 bg-white/5 text-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function ProjectCard({
  title,
  desc,
  href,
  badge,
  badgeTone,
  disabled,
  cta,
}: {
  title: string;
  desc: string;
  href?: string;
  badge: string;
  badgeTone?: "live" | "soon" | "neutral";
  disabled?: boolean;
  cta?: string;
}) {
  const inner = (
    <div
      className={[
        "rounded-3xl border p-6 transition",
        disabled
          ? "border-white/10 bg-black/20 opacity-90"
          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-300">{desc}</div>
        </div>
        <Badge tone={badgeTone}>{badge}</Badge>
      </div>

      <div className="mt-5 text-sm text-gray-300">
        {disabled ? (
          <span className="text-gray-400">{cta ?? "Coming soon"}</span>
        ) : (
          <span>{cta ?? "Open →"}</span>
        )}
      </div>
    </div>
  );

  if (!href) return inner;

  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

function MiniChartPreview() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Monte Carlo Risk Preview</div>
        <span className="text-xs text-gray-400">Mock</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Expected Return</div>
          <div className="mt-1 text-lg font-semibold text-white">8.4%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Volatility</div>
          <div className="mt-1 text-lg font-semibold text-white">12.7%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Max Drawdown</div>
          <div className="mt-1 text-lg font-semibold text-white">-18.3%</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs text-gray-400">Equity Curve</div>
        <svg viewBox="0 0 600 180" className="mt-3 h-40 w-full">
          <defs>
            <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.20)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
          </defs>
          <path
            d="M10,140 C60,120 90,125 130,110 C170,95 210,115 250,90 C290,65 330,80 370,70 C410,60 450,75 490,55 C530,40 560,48 590,35"
            fill="none"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="3"
          />
          <path
            d="M10,140 C60,120 90,125 130,110 C170,95 210,115 250,90 C290,65 330,80 370,70 C410,60 450,75 490,55 C530,40 560,48 590,35 L590,170 L10,170 Z"
            fill="url(#g)"
          />
          <line x1="10" y1="170" x2="590" y2="170" stroke="rgba(255,255,255,0.12)" />
        </svg>
        <div className="mt-2 text-xs text-gray-400">
          (Placeholder preview — swap in real MC charts later.)
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              {/* ✅ Correct sizing (square, premium) */}
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <Image
                  src="/brand/napa-logo-icon.svg"
                  alt="Napa Analytics"
                  width={28}
                  height={28}
                  priority
                />
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">Napa Analytics</div>
                <div className="text-xs text-gray-400">Quantitative dashboards</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 text-sm text-gray-300 md:flex">
              <Link
                href="#projects"
                className="rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white"
              >
                Projects
              </Link>
              <Link
                href="#methodology"
                className="rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white"
              >
                Methodology
              </Link>
              <Link
                href="#about"
                className="rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white"
              >
                About
              </Link>
            </nav>

            <Link
              href="#projects"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200"
            >
              View projects
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Napa Analytics
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
              Quant analytics and risk modeling
            </h1>
            <p className="mt-5 text-base leading-relaxed text-gray-300 md:text-lg">
              A home for data-driven projects — from competitive performance models to
              institutional-grade Monte Carlo portfolio analytics.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#projects"
                className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200"
              >
                View projects
              </Link>
              <Link
                href={SURVIVOR}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Open SurvivorStats →
              </Link>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-14 grid gap-4 md:grid-cols-4">
            <Card label="Models built" value="3" sub="Ranking • H2H • Prediction" />
            <Card label="Data points analyzed" value="50,000+" sub="Duels • Episodes • Aggregates" />
            <Card label="Projects" value="2" sub="1 live • 1 coming soon" />
            <Card label="Last update" value="Feb 2026" sub="Active development" />
          </div>
        </section>

        {/* Projects */}
        <section id="projects" className="py-16 md:py-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Projects
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Platforms and dashboards
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 md:text-base">
                Each project is a focused analytics product with clean tables, strong KPIs,
                and decision-grade summaries.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <ProjectCard
              title="Survivor Greece Analytics"
              desc="Power ratings, duel modeling, team dominance, movers, and episode-level analysis — presented as a modern dashboard."
              href={SURVIVOR}
              badge="Live"
              badgeTone="live"
              cta="Open →"
            />

            {/* ✅ Now clickable to the coming-soon preview page */}
            <ProjectCard
              title="Monte Carlo Portfolio Analytics"
              desc="Risk modeling, scenario simulation, portfolio construction, and institutional-style performance analytics (Portfolio Visualizer inspired)."
              href={MC}
              badge="Preview"
              badgeTone="soon"
              cta="Preview →"
            />
          </div>
        </section>

        {/* Featured preview */}
        <section className="py-16 md:py-24">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Featured
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Portfolio Visualizer style — but yours
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-gray-300 md:text-base">
                MC Analytics will focus on risk and portfolio decisions: distribution-aware
                forecasts, stress testing, efficient frontiers, and clean reporting. Same
                minimal design language as SurvivorStats — adapted to financial analytics.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge tone="neutral">Deep navy</Badge>
                <Badge tone="neutral">Subtle cards</Badge>
                <Badge tone="neutral">Large KPIs</Badge>
                <Badge tone="neutral">Clean tables</Badge>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Design rules
                </div>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  <li>• Minimal, institutional hierarchy</li>
                  <li>• Dense information, high readability</li>
                  <li>• Accents only for meaning (trend, team, risk)</li>
                  <li>• No decorative gradients, no bright UI noise</li>
                </ul>
              </div>

              <div className="mt-6">
                <Link
                  href={MC}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  Open MC Analytics preview →
                </Link>
              </div>
            </div>

            <MiniChartPreview />
          </div>
        </section>

        {/* Methodology */}
        <section id="methodology" className="py-16 md:py-24">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Methodology
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Built for decisions
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
              Napa Analytics projects emphasize transparent metrics, stable definitions, and
              presentation that supports real decisions. SurvivorStats focuses on performance
              models and rankings; MC Analytics focuses on risk, distributions, and portfolio
              construction.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Card label="Clarity" value="Stable metrics" sub="Consistent definitions over time" />
              <Card label="Rigor" value="Model-first" sub="Aggregations reflect the data structure" />
              <Card label="Design" value="Institutional" sub="Readable, minimal, decision-oriented" />
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-12 md:py-16">
          <div className="flex flex-col gap-3 border-t border-white/10 py-10 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Napa Analytics</div>
              <div className="mt-1 text-sm text-gray-400">
                Quant dashboards • Risk modeling • Portfolio analytics
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Home
              </Link>
              <Link
                href="#projects"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Projects
              </Link>
              <Link
                href={SURVIVOR}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                SurvivorStats
              </Link>
              <Link
                href={MC}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                MC Analytics
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-sm text-gray-400">© 2026 Napa Analytics</div>
        </div>
      </footer>
    </div>
  );
}
