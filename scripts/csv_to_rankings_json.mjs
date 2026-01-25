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

// ---------------- CSV PARSER ----------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    // Escaped quote
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    // Toggle quote mode
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    // Cell delimiter
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    // Row delimiter
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++; // CRLF
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
  if (x == null) return null;
  const s = String(x).trim();
  if (!s) return null;

  // handle "90.00%", "90,00%", "1,234.56"
  const cleaned = s.replace("%", "").replace(/\s+/g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function safeReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const txt = fs.readFileSync(filePath, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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

function buildPrevMap(prevRows) {
  const m = new Map();
  for (const r of prevRows || []) {
    if (!r || r.id == null) continue;
    m.set(String(r.id), r);
  }
  return m;
}

function computeTrend(currPower, prevPower) {
  if (prevPower == null || !Number.isFinite(prevPower)) return "flat";
  const d = currPower - prevPower;
  if (d > EPS) return "up";
  if (d < -EPS) return "down";
  return "flat";
}

// ✅ Universal: prefer Adjusted PR
function getDisplayPower(row) {
  const adj = toNumber(row?.power_adj);
  if (adj != null) return adj;
  const p = toNumber(row?.power);
  if (p != null) return p;
  const raw = toNumber(row?.power_raw);
  if (raw != null) return raw;
  return 0;
}

// ---------------- MAPPING ----------------

// Map a Player_Summary row -> rankings row
function mapRow(obj) {
  const id = obj.playerid ?? obj.player_id ?? obj.id ?? obj.pid;
  const name = obj.playername ?? obj.player_name ?? obj.name;
  const team = obj.team ?? obj.team_name ?? obj.teamname;

  // We want Adjusted PR to be the universal "power"
  const powerAdjRaw =
    obj.adjusted_pr ??
    obj.adjustedpr ??
    obj.adjusted_power ??
    obj.adjusted_rating;

  // Keep old metric around (optional)
  const powerRaw =
    obj.powerrating ??
    obj.power_rating ??
    obj.power ??
    obj.power_score ??
    obj.powerscore ??
    obj.score ??
    obj.rank_score;

  const trendRaw = obj.trend ?? obj.momentum ?? obj.direction ?? obj.trend_direction;

  if (!id || !name || !team) return null;

  const power_adj = toNumber(powerAdjRaw);
  const power_raw = toNumber(powerRaw);

  // ✅ If adjusted is missing for some reason, fallback to raw
  const power = power_adj != null ? power_adj : power_raw;

  if (power == null) return null;

  const trendFallback = String(trendRaw ?? "flat").toLowerCase();
  const trendFixed =
    trendFallback === "up" || trendFallback === "down" || trendFallback === "flat"
      ? trendFallback
      : "flat";

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    // ✅ UNIVERSAL POWER
    power: Number(power.toFixed(2)),

    // keep both for debugging / future
    power_adj: power_adj == null ? null : Number(power_adj.toFixed(2)),
    power_raw: power_raw == null ? null : Number(power_raw.toFixed(2)),

    trend: trendFixed, // overwritten by compare if possible
  };
}

// ---------------- MAIN ----------------

if (!fs.existsSync(inPath)) {
  console.error(`Missing file: ${inPath}`);
  process.exit(1);
}

const csvText = fs.readFileSync(inPath, "utf8");
const rows = parseCSV(csvText);

if (rows.length < 2) {
  console.error("CSV looks empty (need header + at least 1 row).");
  process.exit(1);
}

const headers = rows[0].map(normalizeHeader);

// Read previous rankings.json so we can compute trend
const prevData = safeReadJSON(outPath);
const prevMap = buildPrevMap(prevData);

// Build current data
let data = rows
  .slice(1)
  .map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return mapRow(obj);
  })
  .filter(Boolean);

// Trend compare based on UNIVERSAL power (Adjusted PR now)
data = data.map((r) => {
  const prev = prevMap.get(String(r.id));
  const prevPower = prev ? getDisplayPower(prev) : null;
  const currPower = getDisplayPower(r);
  const trend = computeTrend(currPower, prevPower);
  return { ...r, trend };
});

// Sort by universal power desc
data.sort((a, b) => getDisplayPower(b) - getDisplayPower(a));

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
ensureDir(archiveDir);
const archiveName = `rankings_${nowStamp()}.json`;
const archivePath = path.join(archiveDir, archiveName);
fs.writeFileSync(archivePath, JSON.stringify(data, null, 2), "utf8");
console.log(`ℹ️ Archive folder: ${archiveDir}`);
console.log(`ℹ️ Snapshot archived: ${archivePath}`);
