import BrandMark from "@/app/projects/survivor-stats/components/BrandMark";
import TopNav from "@/app/projects/survivor-stats/components/TopNav";
import Link from "next/link";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Survivor Greece Stats",
  description: "Data-driven rankings, duel analytics, and episode predictions",
};

export default function SurvivorStatsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.className} antialiased min-h-screen bg-napa-navy text-white`}>
      <div className="theme-surface">
        <div className="theme-content">
          {/* HEADER */}
          <header className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <BrandMark />
                <TopNav />
                <Link
                  href="/upgrade"
                  className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
