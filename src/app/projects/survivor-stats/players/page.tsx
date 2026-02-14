// src/app/projects/survivor-stats/players/page.tsx
import PlayersExplorerClient from "@/components/explorer/PlayersExplorerClient";
import duels from "@/data/explorer/duels.v1.json";
import meta from "@/data/explorer/meta.v1.json";

// Using searchParams means this is effectively dynamic in newer Next versions.
export const dynamic = "force-dynamic";

export default async function PlayersExplorerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(resolved)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) qs.set(k, v.join(","));
  }

  return (
    <PlayersExplorerClient
      duels={duels as any}
      meta={meta as any}
      initialQueryString={qs.toString()}
    />
  );
}
