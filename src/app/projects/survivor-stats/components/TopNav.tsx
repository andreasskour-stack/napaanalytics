"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string; // simple symbol icons
};

const BASE = "/projects/survivor-stats";

const NAV: NavItem[] = [
  { href: `${BASE}`, label: "Home", icon: "⌂" },
  { href: `${BASE}/players`, label: "Players", icon: "👤" },
  { href: `${BASE}/teams`, label: "Teams", icon: "👥" },
  { href: `${BASE}/episodes`, label: "Episodes", icon: "📅" },
  { href: `${BASE}/rankings`, label: "Rankings", icon: "🏆" },
  { href: `${BASE}/h2h`, label: "H2H", icon: "⚔" },
  { href: `${BASE}/predictions`, label: "Predictions", icon: "🔮" },
];

function isActivePath(pathname: string, href: string) {
  // exact match for project home
  if (href === BASE) return pathname === BASE;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeItem = useMemo(() => {
    const found = NAV.find((n) => isActivePath(pathname, n.href));
    return found ?? NAV[0];
  }, [pathname]);

  // close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* ✅ Desktop */}
      <nav className="hidden items-center gap-2 text-sm text-gray-300 md:flex">
        {NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-xl px-3 py-2 transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-gray-300 hover:bg-white/5 hover:text-white",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ✅ Mobile */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={activeItem.href}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 hover:bg-white/10"
            title={activeItem.label}
          >
            <span className="text-base">{activeItem.icon}</span>
            <span className="font-medium">{activeItem.label}</span>
          </Link>

          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 hover:bg-white/10"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>

        {open ? (
          <div className="fixed inset-0 z-50">
            <button
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />

            <div className="absolute right-0 top-0 h-full w-[82%] max-w-xs border-l border-white/10 bg-black p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-100">Menu</div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 hover:bg-white/10"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                {NAV.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                        active
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10",
                      ].join(" ")}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                      {active ? (
                        <span className="ml-auto text-xs text-gray-300">●</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              {/* Optional: back to Napa Analytics main site */}
              <div className="mt-6 border-t border-white/10 pt-4">
                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200 hover:bg-white/10"
                >
                  <span className="text-lg">↩</span>
                  <span className="font-medium">Napa Analytics</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
