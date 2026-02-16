"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type RunManifestLite = {
  run_id: string;
  timestamp: string;
};

function fmtRunLabel(m: RunManifestLite) {
  // Keep it simple + stable. You can make it prettier later.
  // Example: "2026-02-15_run_001 • 2026-02-15T21:30:00Z"
  return `${m.run_id} • ${m.timestamp.replace("T", " ").replace("Z", " UTC")}`;
}

export default function RunPickerClient({
  runs,
  selectedRunId,
}: {
  runs: RunManifestLite[];
  selectedRunId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const options = useMemo(() => runs, [runs]);

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Run</div>

      <select
        value={selectedRunId}
        onChange={(e) => {
          const next = e.target.value;

          // preserve other query params if you add them later
          const params = new URLSearchParams(sp.toString());
          params.set("run", next);

          router.push(`/projects/mc-analytics?${params.toString()}`);
        }}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 outline-none hover:bg-white/10"
      >
        {options.map((m) => (
          <option key={m.run_id} value={m.run_id} className="bg-[#0B1220]">
            {fmtRunLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
