"use client";

import { useMemo, useState, useEffect } from "react";
import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";
import playersRaw from "@/data/players.json";
import h2hRaw from "@/data/h2h.json";

type Player = {
  id: string;
  name: string;
  team: string;
  isEliminated?: boolean;
  eliminatedEpisode?: number | null;
};

type H2HScore = {
  aWins: number;
  bWins: number;
  aPct: number | null;
  bPct: number | null;
  total: number;
  raw: string;
};

type H2HData = {
  players: Record<string, { id: string; name: string }>;
  score: Record<string, H2HScore>;
  dominance: Record<string, number>;
};

const PLAYERS = playersRaw as Player[];
const H2H = h2hRaw as H2HData;

function teamStyle(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  if (t === "athinaioi") return "bg-red-500/20 border-red-400/40";
  if (t === "eparxiotes") return "bg-blue-500/20 border-blue-400/40";
  return "bg-white/5 border-white/10";
}

function chip(team: string) {
  const t = (team ?? "").trim().toLowerCase();
  if (t === "athinaioi") return "bg-red-500/20 border-red-400/40 text-red-100";
  if (t === "eparxiotes") return "bg-blue-500/20 border-blue-400/40 text-blue-100";
  return "bg-white/5 border-white/10 text-gray-200";
}

function fmtPct(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${p.toFixed(1)}%`;
}

function fmtDom(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function scoreColor(aPct: number | null, bPct: number | null) {
  if (aPct == null || bPct == null) return "text-gray-300";
  if (Math.abs(aPct - bPct) < 1e-9) return "text-gray-300";
  return aPct > bPct ? "text-red-300" : "text-blue-300";
}

function nameById(id: string) {
  return H2H.players?.[id]?.name ?? id;
}

function outBadge(elimEp?: number | null) {
  if (elimEp == null) return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gray-200">
      OUT · Ep {Math.round(elimEp)}
    </span>
  );
}

export default function H2HPage() {
  const RED_TEAM = "Athinaioi";
  const BLUE_TEAM = "Eparxiotes";

  const redPlayers = useMemo(
    () =>
      PLAYERS.filter((p) => p.team === RED_TEAM).sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const bluePlayers = useMemo(
    () =>
      PLAYERS.filter((p) => p.team === BLUE_TEAM).sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const [redQuery, setRedQuery] = useState("");
  const [blueQuery, setBlueQuery] = useState("");
  const [redId, setRedId] = useState<string>(redPlayers[0]?.id ?? "");
  const [blueId, setBlueId] = useState<string>(bluePlayers[0]?.id ?? "");

  const [redOpen, setRedOpen] = useState(false);
  const [blueOpen, setBlueOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setRedOpen(false);
        setBlueOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest?.("[data-h2h-picker='red']")) return;
      if (el.closest?.("[data-h2h-picker='blue']")) return;
      setRedOpen(false);
      setBlueOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const redOptions = useMemo(() => {
    const q = redQuery.trim().toLowerCase();
    return q ? redPlayers.filter((p) => p.name.toLowerCase().includes(q)) : redPlayers;
  }, [redQuery, redPlayers]);

  const blueOptions = useMemo(() => {
    const q = blueQuery.trim().toLowerCase();
    return q ? bluePlayers.filter((p) => p.name.toLowerCase().includes(q)) : bluePlayers;
  }, [blueQuery, bluePlayers]);

  const redP = useMemo(
    () => redPlayers.find((p) => String(p.id) === String(redId)) ?? null,
    [redId, redPlayers]
  );

  const blueP = useMemo(
    () => bluePlayers.find((p) => String(p.id) === String(blueId)) ?? null,
    [blueId, bluePlayers]
  );

  const key = `${redId}|${blueId}`;
  const score = H2H.score?.[key] ?? null;
  const dom = H2H.dominance?.[key] ?? null;

  const domRed = dom != null && dom > 0 ? dom : null;
  const domBlue = dom != null && dom < 0 ? Math.abs(dom) : null;

  return (
    <>
      <PageHeader
        title="Head-to-Head"
        subtitle="Pick one Athinaioi (red) vs one Eparxiotes (blue) and see the matchup."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT PICKER (RED) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-h2h-picker="red">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-100">Red (Athinaioi)</div>
            <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${chip(RED_TEAM)}`}>
              {RED_TEAM}
            </span>
          </div>

          <div className={`mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 ${redP?.isEliminated ? "grayscale opacity-75" : ""}`}>
            <div className="text-xs text-gray-400">Selected</div>
            <div className="text-sm font-semibold text-gray-100">
              {redP?.name ?? nameById(redId)}
              {outBadge(redP?.eliminatedEpisode ?? null)}
            </div>
          </div>

          <input
            value={redQuery}
            onChange={(e) => setRedQuery(e.target.value)}
            onFocus={() => {
              setRedOpen(true);
              setBlueOpen(false);
            }}
            placeholder="Tap to search Athinaioi…"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
          />

          {redOpen ? (
            <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
              {redOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setRedId(p.id);
                    setRedOpen(false);
                    setRedQuery("");
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    String(p.id) === String(redId)
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  } ${p.isEliminated ? "grayscale opacity-75" : ""}`}
                >
                  <div className="font-medium text-gray-100">
                    {p.name} {outBadge(p.eliminatedEpisode ?? null)}
                  </div>
                  <div className="text-xs text-gray-400">ID: {p.id}</div>
                </button>
              ))}

              {redOptions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-gray-300">
                  No matches.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* RIGHT PICKER (BLUE) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-h2h-picker="blue">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-100">Blue (Eparxiotes)</div>
            <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${chip(BLUE_TEAM)}`}>
              {BLUE_TEAM}
            </span>
          </div>

          <div className={`mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 ${blueP?.isEliminated ? "grayscale opacity-75" : ""}`}>
            <div className="text-xs text-gray-400">Selected</div>
            <div className="text-sm font-semibold text-gray-100">
              {blueP?.name ?? nameById(blueId)}
              {outBadge(blueP?.eliminatedEpisode ?? null)}
            </div>
          </div>

          <input
            value={blueQuery}
            onChange={(e) => setBlueQuery(e.target.value)}
            onFocus={() => {
              setBlueOpen(true);
              setRedOpen(false);
            }}
            placeholder="Tap to search Eparxiotes…"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-400"
          />

          {blueOpen ? (
            <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
              {blueOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setBlueId(p.id);
                    setBlueOpen(false);
                    setBlueQuery("");
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    String(p.id) === String(blueId)
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  } ${p.isEliminated ? "grayscale opacity-75" : ""}`}
                >
                  <div className="font-medium text-gray-100">
                    {p.name} {outBadge(p.eliminatedEpisode ?? null)}
                  </div>
                  <div className="text-xs text-gray-400">ID: {p.id}</div>
                </button>
              ))}

              {blueOptions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-gray-300">
                  No matches.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* RESULT CARD */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-xs uppercase tracking-wide text-gray-400">Matchup result</div>

        <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-center">
          <div className={`rounded-2xl border p-4 ${teamStyle(RED_TEAM)} ${redP?.isEliminated ? "grayscale opacity-75" : ""}`}>
            <div className="text-lg font-semibold text-gray-100">
              {redP?.name ?? nameById(redId)}
              {outBadge(redP?.eliminatedEpisode ?? null)}
            </div>
            <div className="mt-1 text-sm text-gray-300">Win%: {fmtPct(score?.aPct ?? null)}</div>
            <div className="mt-1 text-sm text-gray-300">
              Dominance: <span className="text-gray-100">{domRed != null ? fmtDom(domRed) : "—"}</span>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-gray-400">Score</div>
            <div className={`mt-2 text-4xl font-extrabold ${scoreColor(score?.aPct ?? null, score?.bPct ?? null)}`}>
              {score ? score.raw : "—"}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {score ? `Based on ${score.total} duel(s)` : "No data for this pairing"}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${teamStyle(BLUE_TEAM)} ${blueP?.isEliminated ? "grayscale opacity-75" : ""}`}>
            <div className="text-lg font-semibold text-gray-100">
              {blueP?.name ?? nameById(blueId)}
              {outBadge(blueP?.eliminatedEpisode ?? null)}
            </div>
            <div className="mt-1 text-sm text-gray-300">Win%: {fmtPct(score?.bPct ?? null)}</div>
            <div className="mt-1 text-sm text-gray-300">
              Dominance: <span className="text-gray-100">{domBlue != null ? fmtDom(domBlue) : "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
