// src/app/projects/survivor-stats/players/page.tsx
import PlayersExplorerClient from "@/components/explorer/PlayersExplorerClient";
import duels from "@/data/explorer/duels.v1.json";
import meta from "@/data/explorer/meta.v1.json";

export const dynamic = "force-static";

export default function PlayersExplorerPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) {
      // if Next gives repeated params, preserve them as CSV
      qs.set(k, v.join(","));
    }
  }

  return (
    <PlayersExplorerClient
      duels={duels as any}
      meta={meta as any}
      initialQueryString={qs.toString()}
    />
  );
}
