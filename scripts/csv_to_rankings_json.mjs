import fs from "fs";
import path from "path";

const root = process.cwd();

// ✅ Single source of truth:
const inPath = path.join(root, "src", "data", "players.csv");

// Outputs
const outPath = path.join(root, "src", "data", "rankings.json");
const prevOutPath = path.join(root, "src", "data", "rankings.prev.json");
const archiveDir = path.join(root, "src", "data", "archive");

// Trend sensitivity for POWER delta:
// If power barely moves, we fall back to rank movement (so you still get up/down).
const EPS_POWER = 0.05; // power delta threshold

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
    if ((ch === "," || ch === ";") && !inQuotes) {
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

function toNumber(x) {
  if (x === undefined || x === null) return null;
  const s = String(x)
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function round2(n) {
  return n == null ? null : Number(n.toFixed(2));
}

function tsNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
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

// Build a stable “signature” to decide if two snapshots are identical
function snapshotSignature(rows) {
  // sort by id to be stable, compare key fields that matter
  const parts = (rows || [])
    .slice()
    .map((r) => ({
      id: String(r?.id ?? "").trim(),
      power: Number(r?.power ?? 0),
      eliminatedEpisode:
        r?.eliminatedEpisode == null ? null : Math.round(Number(r.eliminatedEpisode)),
      isEliminated: !!r?.isEliminated,
    }))
    .filter((r) => r.id)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (r) =>
        `${r.id}|${Number.isFinite(r.power) ? r.power.toFixed(4) : "NaN"}|${r.eliminatedEpisode ?? ""}|${
          r.isEliminated ? 1 : 0
        }`
    );

  return parts.join("\n");
}

// Find the most recent snapshot in /archive that is NOT identical to current data
function findMostRecentNonIdenticalSnapshot(currentData) {
  const files = listSnapshotFiles();
  if (!files.length) return null;

  const currSig = snapshotSignature(currentData);

  // scan from newest to oldest
  for (let i = files.length - 1; i >= 0; i--) {
    const f = files[i];
    const p = path.join(archiveDir, f);
    const cand = safeReadJSON(p);
    if (!Array.isArray(cand)) continue;

    const sig = snapshotSignature(cand);
    if (sig !== currSig) {
      return { file: f, data: cand };
    }
  }

  return null;
}

// ---------------- ROW MAPPER ----------------
function mapRow(obj, currentEpisode) {
  const id = pick(obj, ["playerid", "player_id", "id", "pid"]);
  const name = pick(obj, ["playername", "player_name", "name"]);
  const team = pick(obj, ["team", "team_name"]);

  if (!id || !name || !team) return null;

  // Universal power = Adjusted PR, fallback to raw if needed
  const powerAdj =
    toNumber(pick(obj, ["adjusted_pr", "adjustedpr", "adjusted_power", "adjusted_rating"])) ??
    null;
  const powerRaw = toNumber(pick(obj, ["powerrating", "power_rating", "power"])) ?? null;

  const power = powerAdj != null ? powerAdj : powerRaw;

  // Elimination signal
  const eliminatedEpisode =
    toNumber(pick(obj, ["eliminatedepisode", "eliminated_episode", "eliminated_ep"])) ?? null;

  const isEliminated =
    eliminatedEpisode != null && Number.isFinite(eliminatedEpisode)
      ? currentEpisode >= eliminatedEpisode
      : false;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    power: power == null ? 0 : Number(power),

    power_adj: powerAdj == null ? null : round2(powerAdj),
    power_raw: powerRaw == null ? null : round2(powerRaw),

    eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
    isEliminated,

    trend: "flat", // computed below vs prev snapshot
  };
}

// Compute trend against prev snapshot rows
// Hybrid logic:
//   1) If power moved by more than EPS_POWER => up/down by power delta
//   2) Otherwise, use rank movement (position in sorted list) as a tie-breaker
function computeTrend(currRows, prevRows) {
  const prevMap = new Map();
  for (const r of prevRows || []) {
    if (r?.id != null) prevMap.set(String(r.id).trim(), r);
  }

  // Rank maps (1 = best)
  const prevRank = new Map();
  (prevRows || [])
    .slice()
    .sort((a, b) => Number(b?.power ?? 0) - Number(a?.power ?? 0))
    .forEach((r, idx) => {
      if (r?.id != null) prevRank.set(String(r.id).trim(), idx + 1);
    });

  const currRank = new Map();
  (currRows || []).forEach((r, idx) => {
    if (r?.id != null) currRank.set(String(r.id).trim(), idx + 1);
  });

  return (currRows || []).map((r) => {
    const id = String(r.id).trim();
    const prev = prevMap.get(id);

    const prevPower = prev ? Number(prev.power ?? 0) : null;
    const currPower = Number(r.power ?? 0);

    let trend = "flat";

    if (prevPower != null && Number.isFinite(prevPower) && Number.isFinite(currPower)) {
      const d = currPower - prevPower;

      if (d > EPS_POWER) trend = "up";
      else if (d < -EPS_POWER) trend = "down";
      else {
        // Power basically unchanged — use rank movement (if available)
        const pr = prevRank.get(id);
        const cr = currRank.get(id);
        if (pr != null && cr != null) {
          if (cr < pr) trend = "up";
          else if (cr > pr) trend = "down";
        }
      }
    }

    return { ...r, trend };
  });
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

// Read previous rankings.json (for freezing / continuity)
const prevLive = safeReadJSON(outPath);
const prevLiveMap = new Map();
if (Array.isArray(prevLive)) {
  for (const r of prevLive) {
    if (r?.id != null) prevLiveMap.set(String(r.id).trim(), r);
  }
}

// Build current data from CSV
let data = rows
  .slice(1)
  .map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return mapRow(obj, currentEpisode);
  })
  .filter(Boolean);

// ✅ Freeze eliminated players after their elimination episode
// If eliminatedEpisode = 5, they still appear normally on episode 5,
// and freeze from episode 6+ (currentEpisode > 5).
data = data.map((r) => {
  const elimEp =
    r?.eliminatedEpisode != null && Number.isFinite(Number(r.eliminatedEpisode))
      ? Math.round(Number(r.eliminatedEpisode))
      : null;

  if (elimEp == null) return r;

  if (currentEpisode > elimEp) {
    const prev = prevLiveMap.get(String(r.id).trim());
    if (prev) {
      return {
        ...prev,
        eliminatedEpisode: elimEp,
        isEliminated: true,
        // trend will be recomputed below
        trend: "flat",
      };
    }
  }

  return {
    ...r,
    eliminatedEpisode: elimEp,
    isEliminated: currentEpisode >= elimEp,
  };
});

// Sort by power (desc) for display
data = data
  .slice()
  .sort((a, b) => Number(b.power ?? 0) - Number(a.power ?? 0));

// ✅ Pick previous snapshot intelligently:
//    - use the most recent archive snapshot that is NOT identical to current data.
//    - fallback: previous live rankings.json if no non-identical archive exists.
const prevSnap = findMostRecentNonIdenticalSnapshot(data);
const prevForTrend = prevSnap?.data ?? (Array.isArray(prevLive) ? prevLive : null);

if (prevSnap?.file) {
  console.log(`ℹ️ Trend baseline: ${prevSnap.file} (non-identical snapshot)`);
} else if (Array.isArray(prevLive)) {
  console.log("ℹ️ Trend baseline: previous rankings.json (no non-identical archive found)");
} else {
  console.log("ℹ️ Trend baseline: none found (all trends may be flat)");
}

// ✅ Compute trend
if (Array.isArray(prevForTrend)) {
  data = computeTrend(data, prevForTrend);
}

// Write rankings.prev.json (debuggable baseline)
try {
  fs.writeFileSync(prevOutPath, JSON.stringify(prevForTrend ?? null, null, 2), "utf8");
} catch {}

// ✅ IMPORTANT: avoid creating fake episodes / snapshots
// Only archive if current data differs from the latest archived snapshot.
// (Signature ignores trend, so identical data won't create new snapshot.)
const files = listSnapshotFiles();
const lastFile = files.length ? files[files.length - 1] : null;
const lastPath = lastFile ? path.join(archiveDir, lastFile) : null;
const lastData = lastPath ? safeReadJSON(lastPath) : null;

const currSig = snapshotSignature(data);
const lastSig = Array.isArray(lastData) ? snapshotSignature(lastData) : null;

const shouldArchive = !(lastSig && lastSig === currSig);

if (shouldArchive) {
  const stamp = tsNow();
  const snapName = `rankings_${stamp}.json`;
  const snapPath = path.join(archiveDir, snapName);
  fs.writeFileSync(snapPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ Archived snapshot: ${snapName}`);
} else {
  console.log("ℹ️ Snapshot NOT archived (identical to latest snapshot) — no fake episode created.");
}

// Write live rankings.json
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Wrote ${data.length} rows to ${outPath}`);
