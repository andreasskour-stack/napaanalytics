// src/app/projects/survivor-stats/explorer/page.tsx
import PlayersExplorerClient from "@/components/explorer/PlayersExplorerClient";
import duels from "@/data/explorer/duels.v1.json";
import meta from "@/data/explorer/meta.v1.json";

export default function ExplorerPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Players Explorer</h1>
        <p className="mt-2 text-sm text-white/70">
          Filter duel-level events (PropType, TargetType, GamePrize, Puzzle, AirDate, Week) and rank players by performance.
        </p>
      </div>

      <PlayersExplorerClient duels={duels as any} meta={meta as any} />
    </main>
  );
}
