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

function parseCSVRowsSkipEmpty(csvPath) {
  const raw = readText(csvPath);
  const lines = raw.split(/\r?\n/).filter((ln) => ln != null);

  const headerIndex = lines.findIndex(isMeaningfulCsvLine);
  if (headerIndex === -1) return { headers: [], rows: [] };

  const headerLine = lines[headerIndex].replace(/^\uFEFF/, "");
  const headers = headerLine.split(",").map((h) => h.trim());

  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!isMeaningfulCsvLine(line)) continue;
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    rows.push(obj);
  }

  return { headers, rows };
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

/* =========================
   Snapshot normalization
   Accepts BOTH:
   - { meta: {...}, rankings: [...] }
   - [...]  (array snapshot)
========================= */
function normalizeSnapshotData(data) {
  // Newer / expected format
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rankings = Array.isArray(data.rankings) ? data.rankings : [];
    const meta = data.meta && typeof data.meta === "object" ? data.meta : {};
    return { rankings, meta };
  }

  // Backfilled / legacy format: plain array
  if (Array.isArray(data)) {
    return { rankings: data, meta: {} };
  }

  return { rankings: [], meta: {} };
}

/* =========================
   Labels
========================= */
function getEpisodeLabel(ep) {
  return `Episode ${ep}`;
}

/* =========================
   Diff between two snapshots
========================= */
function computeDiff(prevRows, currRows) {
  const prevById = new Map();
  for (const r of prevRows || []) {
    prevById.set(String(r.id), r);
  }

  const diffs = [];
  for (const r of currRows || []) {
    const id = String(r.id);
    const prev = prevById.get(id) || null;

    const currPower = safeNum(r.power, 0);
    const prevPower = prev ? safeNum(prev.power, 0) : null;

    const delta = prevPower == null ? null : currPower - prevPower;

    diffs.push({
      id,
      name: r.name,
      team: r.team,
      currPower,
      prevPower,
      delta,
    });
  }

  const withDelta = diffs.filter((d) => d.delta != null);
  const sortedUp = [...withDelta].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const sortedDown = [...withDelta].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  function asMover(d) {
    return {
      id: String(d.id),
      name: String(d.name ?? ""),
      team: String(d.team ?? ""),
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

    const redWon = safeNum(r.RedWon, 0);
    const blueWon = safeNum(r.BlueWon, 0);

    const key = `${ep}__${matchId}`;
    if (!map.has(key)) {
      map.set(key, { ep, matchId, gameType, redScore: 0, blueScore: 0 });
    }
    const acc = map.get(key);
    acc.redScore += redWon;
    acc.blueScore += blueWon;
  }

  // pick best match per episode (highest total rounds)
  const bestByEp = new Map();

  const grouped = new Map();
  for (const v of map.values()) {
    if (!grouped.has(v.ep)) grouped.set(v.ep, []);
    grouped.get(v.ep).push(v);
  }

  for (const [ep, matches] of grouped.entries()) {
    matches.sort((a, b) => (b.redScore + b.blueScore) - (a.redScore + a.blueScore));
    const best = matches[0];
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
  const prevNorm = normalizeSnapshotData(snaps[ep - 1].data);
  const currNorm = normalizeSnapshotData(snaps[ep].data);

  const prevRows = prevNorm.rankings;
  const currRows = currNorm.rankings;

  const diff = computeDiff(prevRows, currRows);

  // TV episode id defaults to ep, fallback ep+1
  const tv = ep;
  let teamResult = teamScoresByTvEpisode.get(String(tv)) ?? null;
  if (!teamResult) teamResult = teamScoresByTvEpisode.get(String(tv + 1)) ?? null;

  const entry = {
    id: String(ep),
    label: getEpisodeLabel(ep),
    dateISO: currNorm.meta?.builtAtISO ?? null,
    prevSnapshot: `ep_${pad3(ep - 1)}`,
    currSnapshot: `ep_${pad3(ep)}`,
    summary: {
      comparedPlayers: diff.comparedPlayers,
      biggestRise: diff.biggestRise,
      biggestFall: diff.biggestFall,
      biggestRiseByTeam: diff.biggestRiseByTeam,
      biggestFallByTeam: diff.biggestFallByTeam,
      teamResult,
    },
    movers: diff.movers,
  };

  episodes.push(entry);
}

writeJSON(outPath, episodes);
console.log(`✅ Wrote episodes.json with ${episodes.length} episodes (1..${maxEpisode}).`);
