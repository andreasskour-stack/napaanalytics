import fs from "fs";
import path from "path";

const root = process.cwd();
const archiveDir = path.join(root, "src", "data", "archive");
const outPath = path.join(root, "src", "data", "power_history.json");

function safeNum(x, fallback = null) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Prefer Adjusted PR if present, else fallback to power
function getPower(row) {
  const pAdj = safeNum(row?.power_adj, null);
  if (pAdj != null) return pAdj;
  return safeNum(row?.power, 0);
}

// Try to parse timestamp from filename rankings_YYYY-MM-DD_HH-MM-SS-ms.json
function parseDateFromFilename(name) {
  const m = name.match(/rankings_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})\.json$/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function fmtLabel(d) {
  // label like "2026-01-22"
  return d.toISOString().slice(0, 10);
}

if (!fs.existsSync(archiveDir)) {
  console.error(`Missing archive folder: ${archiveDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(archiveDir)
  .filter((f) => f.toLowerCase().endsWith(".json"))
  .map((f) => {
    const full = path.join(archiveDir, f);
    const stat = fs.statSync(full);
    const date = parseDateFromFilename(f) || stat.mtime;
    return { f, full, date };
  })
  // oldest -> newest
  .sort((a, b) => a.date.getTime() - b.date.getTime());

if (files.length === 0) {
  console.error("No archive snapshots found. Run rankings:build at least once.");
  process.exit(1);
}

// historyById: { [playerId]: Array<{ t:number, label:string, power:number }> }
const historyById = new Map();

for (const snap of files) {
  const rows = readJSON(snap.full);
  const label = fmtLabel(snap.date);
  const t = snap.date.getTime();

  if (!Array.isArray(rows)) continue;

  for (const r of rows) {
    const id = String(r?.id ?? "").trim();
    if (!id) continue;

    const power = getPower(r);
    if (!historyById.has(id)) historyById.set(id, []);
    historyById.get(id).push({
      t,
      label,
      power,
    });
  }
}

// Convert to plain object and ensure each series sorted
const out = {};
for (const [id, series] of historyById.entries()) {
  series.sort((a, b) => a.t - b.t);
  out[id] = series;
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`✅ Built power history for ${Object.keys(out).length} players → ${outPath}`);
console.log(`ℹ️ Snapshots read: ${files.length} from ${archiveDir}`);
