import fs from "fs";
import path from "path";

const root = process.cwd();

// ✅ Single source of truth:
const inPath = path.join(root, "src", "data", "players.csv");

// Outputs
const outPath = path.join(root, "src", "data", "rankings.json");
const prevOutPath = path.join(root, "src", "data", "rankings.prev.json");
const archiveDir = path.join(root, "src", "data", "archive");

// Trend sensitivity: smaller = more "up/down", larger = more "flat"
const EPS = 0.5;

// ---------------- HELPERS ----------------
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[%]/g, "pct")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * ✅ IMPORTANT FIX:
 * After cleaning, if the string becomes empty, return null.
 * Otherwise Number("") becomes 0 and breaks eliminatedEpisode logic.
 */
function toNumber(x) {
  if (x === undefined || x === null) return null;

  const cleaned = String(x)
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");

  if (!cleaned) return null; // ✅ prevents "" -> 0

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function getDisplayPower(r) {
  const a = toNumber(r?.power_adj);
  if (a != null) return a;
  const p = toNumber(r?.power);
  if (p != null) return p;
  const raw = toNumber(r?.power_raw);
  if (raw != null) return raw;
  return null;
}

function computeTrend(curr, prev) {
  if (prev == null || curr == null) return "flat";
  const d = curr - prev;
  if (Math.abs(d) < EPS) return "flat";
  return d > 0 ? "up" : "down";
}

function nowStamp() {
  // rankings_2026-01-23_09-15-01-123.json
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}-${ms}`;
}

// Snapshot files used by build_episodes.mjs
function listSnapshotFiles() {
  if (!fs.existsSync(archiveDir)) return [];
  return fs
    .readdirSync(archiveDir)
    .filter((f) => /^rankings_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.json$/.test(f))
    .sort();
}

// When generating the next snapshot, currentEpisode = existingSnapshotsCount.
function getCurrentEpisodeNumber() {
  return listSnapshotFiles().length;
}

// ---------------- ROW MAPPER ----------------
function mapRow(obj, currentEpisode) {
  const id = obj.playerid ?? obj.player_id ?? obj.id ?? obj.pid;
  const name = obj.playername ?? obj.player_name ?? obj.name;
  const team = obj.team ?? obj.team_name ?? obj.teamname;

  // We want Adjusted PR to be the universal "power"
  const powerAdjRaw =
    obj.adjusted_pr ?? obj.adjustedpr ?? obj.adjusted_power ?? obj.adjusted_rating;

  const powerRaw =
    obj.powerrating ??
    obj.power_rating ??
    obj.power ??
    obj.power_score ??
    obj.powerscore ??
    obj.score ??
    obj.rank_score;

  const eliminatedEpisode =
    toNumber(obj.eliminatedepisode ?? obj.eliminated_episode ?? obj.eliminated_ep) ?? null;

  if (!id || !name || !team) return null;

  const power_adj = toNumber(powerAdjRaw);
  const power_raw = toNumber(powerRaw);

  const power = power_adj != null ? power_adj : power_raw;
  if (power == null) return null;

  const isEliminated =
    eliminatedEpisode != null && Number.isFinite(eliminatedEpisode)
      ? currentEpisode >= eliminatedEpisode
      : false;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    power: Number(power.toFixed(2)),

    power_adj: power_adj == null ? null : Number(power_adj.toFixed(2)),
    power_raw: power_raw == null ? null : Number(power_raw.toFixed(2)),

    eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
    isEliminated,

    trend: "flat", // computed below vs prev snapshot
  };
}

// ---------------- MAIN ----------------
if (!fs.existsSync(inPath)) {
  console.error(`Missing file: ${inPath}`);
  process.exit(1);
}

ensureDir(archiveDir);

const currentEpisode = getCurrentEpisodeNumber();
console.log(`ℹ️ Current episode number (derived from snapshots): ${currentEpisode}`);

const csvText = fs.readFileSync(inPath, "utf8");
const rows = parseCSV(csvText);

if (rows.length < 2) {
  console.error("CSV looks empty (need header + at least 1 row).");
  process.exit(1);
}

const headers = rows[0].map(normalizeHeader);

// Read previous rankings.json so we can compute trend + freezing
const prevData = safeReadJSON(outPath);
const prevMap = new Map();
if (Array.isArray(prevData)) {
  for (const r of prevData) {
    if (r?.id != null) prevMap.set(String(r.id), r);
  }
}

// Build current data
let data = rows
  .slice(1)
  .map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return mapRow(obj, currentEpisode);
  })
  .filter(Boolean);

// ✅ Freeze eliminated players after their elimination episode
data = data.map((r) => {
  const elimEp = typeof r?.eliminatedEpisode === "number" ? r.eliminatedEpisode : null;
  if (elimEp == null) return r;

  // freeze from next episode onwards
  if (currentEpisode > elimEp) {
    const prev = prevMap.get(String(r.id));
    if (prev) {
      return {
        ...prev,
        eliminatedEpisode: Math.round(elimEp),
        isEliminated: true,
      };
    }
  }

  return {
    ...r,
    eliminatedEpisode: Math.round(elimEp),
    isEliminated: currentEpisode >= elimEp,
  };
});

// Compute trend
data = data.map((r) => {
  const prev = prevMap.get(String(r.id));
  const prevPower = prev ? getDisplayPower(prev) : null;
  const currPower = getDisplayPower(r);
  const trend = computeTrend(currPower, prevPower);
  return { ...r, trend };
});

// Sort by power desc
data.sort((a, b) => (getDisplayPower(b) ?? -Infinity) - (getDisplayPower(a) ?? -Infinity));

// Save previous snapshot BEFORE overwriting rankings.json
if (prevData && Array.isArray(prevData)) {
  fs.writeFileSync(prevOutPath, JSON.stringify(prevData, null, 2), "utf8");
  console.log(`ℹ️ Trend compare: ${prevData.length} previous rows loaded; EPS=${EPS}`);
  console.log(`ℹ️ Previous snapshot saved to: ${prevOutPath}`);
} else {
  console.log("ℹ️ Trend compare: no previous rankings.json found (first run or missing).");
}

// Write rankings.json
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Wrote ${data.length} rows to ${outPath}`);

// Archive snapshot (Episodes reads these)
const archiveName = `rankings_${nowStamp()}.json`;
const archivePath = path.join(archiveDir, archiveName);
fs.writeFileSync(archivePath, JSON.stringify(data, null, 2), "utf8");
console.log(`ℹ️ Archive folder: ${archiveDir}`);
console.log(`ℹ️ Snapshot archived: ${archivePath}`);
