import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-8 space-y-10">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
        <h1 className="text-4xl font-semibold">Napa Analytics</h1>
        <p className="mt-4 text-gray-300 max-w-2xl">
          A home for analytics projects, dashboards, and data-driven insights.
        </p>

        <div className="mt-6">
          <Link
            href="/projects/survivor-stats"
            className="inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 hover:bg-white/10"
          >
            Open SurvivorStats →
          </Link>
        </div>
      </div>
    </main>
  );
}
