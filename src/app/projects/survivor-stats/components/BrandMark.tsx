import Link from "next/link";
import Image from "next/image";

const BASE = "/projects/survivor-stats";

export default function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      {/* Napa icon container (click -> Napa home) */}
      <Link
  href="/"
  className="grid h-18 w-24 place-items-center rounded-2xl border border-white/10 bg-white/5 transition hover:bg-white/10"
>
  <Image
    src="/brand/napa-logo-icon.svg"
    alt="Napa Analytics"
    width={70}
    height={70}
    priority
  />
</Link>

      {/* Text context + Project pill */}
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">Napa Analytics</div>

        <Link
          href={BASE}
          className="mt-1 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
          title="Open Survivor Greece Stats"
        >
          Survivor Greece Stats <span className="text-gray-500">▾</span>
        </Link>
      </div>
    </div>
  );
}
