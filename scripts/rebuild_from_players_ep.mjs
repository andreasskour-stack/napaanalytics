import fs from "fs";
import path from "path";

const root = process.cwd();

const duelsPath = path.join(root, "src", "data", "duels.csv");
const rebuildDir = path.join(root, "src", "data", "rebuild_players");
const archiveDir = path.join(root, "src", "data", "archive");

// ---------- helpers ----------
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
function pad3(n) {
  return String(n).padStart(3, "0");
}
function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// duels.csv sometimes has blank first line -> skip empty rows
function isMeaningfulCsvLine(line) {
  if (line == null) return false;
  const s = line.replace(/^\uFEFF/, "").trim();
  if (!s) return false;
  const noCommas = s.replace(/,/g, "").trim();
  return noCommas.length > 0;
}

function parseDuelsMaxEpisodeID(csvPath) {
  if (!fileExists(csvPath)) throw new Error(`duels.csv not found: ${csvPath}`);
  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/);

  const headerIndex = lines.findIndex(isMeaningfulCsvLine);
  if (headerIndex === -1) throw new Error("duels.csv has no header row");

  const headerLine = lines[headerIndex].replace(/^\uFEFF/, "");
  const headers = headerLine.split(",").map((h) => h.trim());

  const epCol = headers.findIndex((h) => h === "EpisodeID");
  if (epCol === -1) {
    throw new Error(`EpisodeID column not found. Headers: ${headers.join(", ")}`);
  }

  let maxEp = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!isMeaningfulCsvLine(ln)) continue;
    const cols = ln.split(",");
    const ep = safeNum(cols[epCol], 0);
    if (ep > maxEp) maxEp = ep;
  }
  return maxEp;
}

function normalizeKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]/g, ""); // remove spaces, %, underscores, etc.
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(isMeaningfulCsvLine);
  if (!lines.length) return [];

  const headers = lines[0].replace(/^\uFEFF/, "").split(",");
  const normHeaders = headers.map(normalizeKey);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const obj = {};
    for (let c = 0; c < normHeaders.length; c++) {
      obj[normHeaders[c]] = (cols[c] ?? "").trim();
    }
    rows.push(obj);
  }
  return rows;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function toNumber(x) {
  if (x == null) return null;
  const s = String(x).trim();
  if (!s) return null;
  // strip % if present
  const cleaned = s.replace(/%/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// ---------- build a rankings snapshot payload ----------
function buildSnapshotFromPlayers(playersRows, currentEpisode) {
  const now = new Date().toISOString();

  const rankings = [];
  for (const r of playersRows) {
    const id = r.playerid;
    const name = r.playername;
    const team = r.team;

    if (!id || !name || !team) continue;

    // Prefer Adjusted PR, fallback to PowerRating
    const powerAdj =
      toNumber(r.adjustedpr) ??
      toNumber(r.adjustedpower) ??
      toNumber(r.adjustedrating) ??
      null;

    const powerRaw =
      toNumber(r.powerrating) ??
      toNumber(r.powerrating) ??
      toNumber(r.power) ??
      null;

    const power = powerAdj != null ? powerAdj : powerRaw;

    const eliminatedEpisode =
      toNumber(r.eliminatedepisode) ??
      toNumber(r.eliminatedep) ??
      null;

    const isEliminated =
      eliminatedEpisode != null && Number.isFinite(eliminatedEpisode)
        ? currentEpisode >= eliminatedEpisode
        : false;

    rankings.push({
      id: String(id).trim(),
      name: String(name).trim(),
      team: String(team).trim(),
      power: power == null ? 0 : Number(power),

      power_adj: powerAdj == null ? null : round2(powerAdj),
      power_raw: powerRaw == null ? null : round2(powerRaw),

      eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
      isEliminated,
      trend: "flat",
    });
  }

  rankings.sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

  return {
    meta: { builtAtISO: now, episode: currentEpisode, source: `players_ep_${pad3(currentEpisode)}.csv` },
    rankings,
  };
}

// ---------- MAIN ----------
ensureDir(archiveDir);

const maxEpisode = parseDuelsMaxEpisodeID(duelsPath);
console.log(`MAX EpisodeID from duels.csv = ${maxEpisode}`);
console.log(`Reading rebuild CSVs from: ${path.relative(root, rebuildDir)}`);

for (let ep = 0; ep <= maxEpisode; ep++) {
  const csvPath = path.join(rebuildDir, `players_ep_${pad3(ep)}.csv`);
  if (!fileExists(csvPath)) {
    throw new Error(`Missing ${path.relative(root, csvPath)} (need EP ${ep})`);
  }

  const rows = readCSV(csvPath);
  const payload = buildSnapshotFromPlayers(rows, ep);

  const snapPath = path.join(archiveDir, `rankings_ep_${pad3(ep)}.json`);
  writeJSON(snapPath, payload);

  console.log(`✅ Wrote ${path.relative(root, snapPath)} (${payload.rankings.length} players)`);
}

console.log("✅ Done creating EP snapshots. Next: npm run episodes:build");
