// src/app/projects/mc-analytics/layout.tsx
import Link from "next/link";
import BrandMark from "@/app/projects/survivor-stats/components/BrandMark";

export default function MCAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-napa-navy text-white">
      {/* Header (matches SurvivorStats tone) */}
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Reuse BrandMark so it feels like the same product family */}
            <div className="flex items-center gap-3">
              <BrandMark />
              <div className="hidden sm:block">
                <div className="text-sm font-semibold tracking-wide text-white">
                  MC Portfolio Analytics
                </div>
                <div className="text-xs text-gray-400">
                  Coming soon • Risk • Portfolio construction
                </div>
              </div>
            </div>

            {/* Right-side actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Napa Home
              </Link>
              <Link
                href="/projects/survivor-stats"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                SurvivorStats
              </Link>
            </div>
          </div>

          {/* Small project pill (same feel as SurvivorStats “module” idea) */}
          <div className="mt-3">
            <span className="inline-flex items-center rounded-xl border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200">
              Preview
            </span>
            <span className="ml-3 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
              Monte Carlo • VaR/CVaR • Efficient Frontier
            </span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
