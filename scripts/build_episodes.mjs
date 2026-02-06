import fs from "fs";
import path from "path";

const root = process.cwd();
const archiveDir = path.join(root, "src", "data", "archive");
const outPath = path.join(root, "src", "data", "episodes.json");
const duelsPath = path.join(root, "src", "data", "duels.csv");

// ===== Helpers =====
function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

// CSV: skip blank rows like "\ufeff,,,,,"
function isMeaningfulCsvLine(line) {
  if (line == null) return false;
  const s = line.replace(/^\uFEFF/, "").trim();
  if (!s) return false;
  const noCommas = s.replace(/,/g, "").trim();
  return noCommas.length > 0;
}

function parseDuelsMaxEpisodeID(csvPath) {
  if (!fileExists(csvPath)) {
    throw new Error(`duels.csv not found at: ${csvPath}`);
  }

  const raw = readText(csvPath);
  const lines = raw.split(/\r?\n/).filter((ln) => ln != null);

  const headerIndex = lines.findIndex(isMeaningfulCsvLine);
  if (headerIndex === -1) throw new Error("duels.csv has no header row");

  const headerLine = lines[headerIndex].replace(/^\uFEFF/, "");
  const headers = headerLine.split(",").map((h) => h.trim());
  const epCol = headers.findIndex((h) => h === "EpisodeID");

  if (epCol === -1) {
    throw new Error(
      `EpisodeID column not found in duels.csv headers. Found: ${headers.join(", ")}`
    );
  }

  let maxEp = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!isMeaningfulCsvLine(line)) continue;

    const cols = line.split(",");
    const ep = safeNum(cols[epCol], 0);
    if (ep > maxEp) maxEp = ep;
  }

  return maxEp;
}

function parseCSVRowsSkipEmpty(csvPath) {
  const raw = readText(csvPath);
  const lines = raw.split(/\r?\n/);

  const idx = lines.findIndex(isMeaningfulCsvLine);
  if (idx === -1) return { headers: [], rows: [] };

  const headerLine = lines[idx].replace(/^\uFEFF/, "");
  const headers = headerLine.split(",").map((h) => h.trim());

  const rows = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!isMeaningfulCsvLine(ln)) continue;
    const cols = ln.split(",");
    const obj = {};
    headers.forEach((h, c) => (obj[h] = (cols[c] ?? "").trim()));
    rows.push(obj);
  }
  return { headers, rows };
}

/* =========================
   Episode labeling
========================= */
function getEpisodeLabel(episodeNum) {
  return `Episode ${episodeNum}`;
}

/* =========================
   Movers / diffs
========================= */
function computeDiff(prevRows, currRows) {
  const prevMap = new Map();
  for (const p of prevRows || []) {
    if (!p || p.id == null) continue;
    prevMap.set(String(p.id), p);
  }

  const diffs = [];
  for (const c of currRows || []) {
    if (!c || c.id == null) continue;

    const id = String(c.id);
    const prev = prevMap.get(id);

    const prevPower =
      prev && prev.power != null && Number.isFinite(Number(prev.power))
        ? Number(prev.power)
        : null;

    const currPower =
      c && c.power != null && Number.isFinite(Number(c.power))
        ? Number(c.power)
        : null;

    const delta =
      prevPower != null && currPower != null ? currPower - prevPower : null;

    diffs.push({
      id,
      name: c.name ?? "",
      team: c.team ?? "",
      prevPower,
      currPower,
      delta,
    });
  }

  const withDelta = diffs.filter((d) => d.delta != null);
  const sortedUp = [...withDelta].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const sortedDown = [...withDelta].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  function asMover(d) {
    return {
      id: d.id,
      name: d.name,
      team: d.team,
      currPower: d.currPower ?? 0,
      prevPower: d.prevPower,
      delta: d.delta,
    };
  }

  function topN(arr, n) {
    return arr.slice(0, n).map(asMover);
  }

  // group by team for per-team movers
  const byTeam = {};
  for (const d of withDelta) {
    const t = d.team || "Unknown";
    if (!byTeam[t]) byTeam[t] = [];
    byTeam[t].push(d);
  }

  const moversByTeam = {};
  const biggestRiseByTeam = {};
  const biggestFallByTeam = {};

  for (const [team, teamRows] of Object.entries(byTeam)) {
    const ups = [...teamRows].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const downs = [...teamRows].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

    moversByTeam[team] = {
      up: topN(ups, 5),
      down: topN(downs, 5),
    };

    biggestRiseByTeam[team] = ups.length ? asMover(ups[0]) : null;
    biggestFallByTeam[team] = downs.length ? asMover(downs[0]) : null;
  }

  return {
    comparedPlayers: diffs.length,
    biggestRise: sortedUp.length ? topN(sortedUp, 1)[0] : null,
    biggestFall: sortedDown.length ? topN(sortedDown, 1)[0] : null,

    // ✅ NEW: what your Episode page expects
    biggestRiseByTeam,
    biggestFallByTeam,

    movers: {
      up: topN(sortedUp, 10),
      down: topN(sortedDown, 10),
      byTeam: moversByTeam,
    },
  };
}

/* =========================
   Snapshot loading (EP-driven)
========================= */
function loadEpSnapshot(ep) {
  const file = path.join(archiveDir, `rankings_ep_${pad3(ep)}.json`);
  if (!fileExists(file)) return null;
  return { file, data: readJSON(file) };
}

function requireSnapshotsUpTo(maxEpisode) {
  const missing = [];
  const snaps = [];

  for (let ep = 0; ep <= maxEpisode; ep++) {
    const s = loadEpSnapshot(ep);
    if (!s) missing.push(ep);
    snaps.push(s);
  }

  if (missing.length) {
    const preview = missing.slice(0, 30).map((x) => `EP${x}`).join(", ");
    throw new Error(
      `Missing EP snapshots in src/data/archive. Need rankings_ep_000..rankings_ep_${pad3(
        maxEpisode
      )}. Missing: ${preview}${missing.length > 30 ? " ..." : ""}`
    );
  }

  return snaps;
}

/* =========================
   Team result from duels.csv
   (1 episode = 1 match; score from RedWon/BlueWon)
========================= */
function computeTeamScoresByEpisode(duelsCsvPath) {
  if (!fileExists(duelsCsvPath)) return new Map();

  const { rows } = parseCSVRowsSkipEmpty(duelsCsvPath);

  // episode -> matchId -> accumulator
  const map = new Map();

  for (const r of rows) {
    const ep = String(r.EpisodeID ?? "").trim();
    if (!ep) continue;

    const matchId = String(r.TeamMatchID ?? "").trim() || "unknown";
    const gameType = String(r.GameType ?? "").trim() || null;

    const redWon = safeNum(r.RedWon ?? 0, 0);
    const blueWon = safeNum(r.BlueWon ?? 0, 0);

    if (!map.has(ep)) map.set(ep, new Map());
    const m = map.get(ep);

    if (!m.has(matchId)) {
      m.set(matchId, {
        matchId,
        gameType,
        redScore: 0,
        blueScore: 0,
      });
    }

    const acc = m.get(matchId);
    acc.redScore += redWon;
    acc.blueScore += blueWon;
    if (!acc.gameType && gameType) acc.gameType = gameType;
  }

  // pick best match per episode (most points)
  const bestByEp = new Map();

  for (const [ep, matches] of map.entries()) {
    let best = null;
    for (const acc of matches.values()) {
      const points = acc.redScore + acc.blueScore;
      if (!best || points > best.redScore + best.blueScore) best = acc;
    }

    if (!best) continue;

    const winner =
      best.redScore > best.blueScore
        ? "Athinaioi"
        : best.blueScore > best.redScore
        ? "Eparxiotes"
        : "Draw";

    bestByEp.set(ep, {
      matchId: best.matchId,
      gameType: best.gameType,
      score: {
        Athinaioi: best.redScore,
        Eparxiotes: best.blueScore,
      },
      winner,
      margin: Math.abs(best.redScore - best.blueScore),
    });
  }

  return bestByEp;
}

/* =========================
   MAIN
========================= */
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

const maxEpisode = parseDuelsMaxEpisodeID(duelsPath);

if (maxEpisode <= 0) {
  console.log("ℹ️ duels.csv has no EpisodeID > 0. Writing empty episodes.json.");
  writeJSON(outPath, []);
  process.exit(0);
}

const snaps = requireSnapshotsUpTo(maxEpisode);
const teamScoresByTvEpisode = computeTeamScoresByEpisode(duelsPath);

const episodes = [];

for (let ep = 1; ep <= maxEpisode; ep++) {
  const prev = snaps[ep - 1].data;
  const curr = snaps[ep].data;

  const prevRows = prev?.rankings ?? [];
  const currRows = curr?.rankings ?? [];

  const diff = computeDiff(prevRows, currRows);

  // ✅ Use episode number as TV EpisodeID by default
  // ✅ Fallback: if duels.csv starts at 2, allow ep+1
  const tv = ep;
  let teamResult = teamScoresByTvEpisode.get(String(tv)) ?? null;
  if (!teamResult) teamResult = teamScoresByTvEpisode.get(String(tv + 1)) ?? null;

  const entry = {
    id: String(ep),
    label: getEpisodeLabel(ep),
    dateISO: curr?.meta?.builtAtISO ?? null,
    prevSnapshot: `ep_${pad3(ep - 1)}`,
    currSnapshot: `ep_${pad3(ep)}`,
    summary: {
      comparedPlayers: diff.comparedPlayers,
      biggestRise: diff.biggestRise,
      biggestFall: diff.biggestFall,

      // ✅ NEW: per-team boxes (your page.tsx already reads these)
      biggestRiseByTeam: diff.biggestRiseByTeam,
      biggestFallByTeam: diff.biggestFallByTeam,

      // team score/winner
      teamResult,
    },
    movers: diff.movers,
  };

  episodes.push(entry);
}

writeJSON(outPath, episodes);
console.log(`✅ Wrote episodes.json with ${episodes.length} episodes (1..${maxEpisode}).`);
