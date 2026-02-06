import fs from "fs";
import path from "path";

const root = process.cwd();

// ✅ Single source of truth:
const inPath = path.join(root, "src", "data", "players.csv");

// Outputs
const outPath = path.join(root, "src", "data", "rankings.json");
const prevOutPath = path.join(root, "src", "data", "rankings.prev.json");

// ✅ archive folder
const archiveDir = path.join(root, "src", "data", "archive");

// Trend sensitivity for POWER delta:
const EPS_POWER = 0.05;

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

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function stableStringify(obj) {
  return JSON.stringify(obj);
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return { headers: [], rows: [] };
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    // naive CSV split – assumes no embedded commas in fields (matches your current setup)
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
  return { headers, rows };
}

// ---------------- MAIN ----------------
ensureDir(archiveDir);

// ✅ optional: EPISODE mode (for deterministic rebuild)
const EP = process.env.EPISODE ? Number(process.env.EPISODE) : null;
if (EP !== null && (!Number.isFinite(EP) || EP < 0)) {
  console.error("Invalid EPISODE env var. Must be a non-negative number.");
  process.exit(1);
}

// 1) read players.csv
if (!fs.existsSync(inPath)) {
  console.error("Missing players.csv at:", inPath);
  process.exit(1);
}
const { rows: players } = readCSV(inPath);

// 2) build rankings payload (based on players.csv current state)
const now = new Date().toISOString();
const rankings = players
  .filter((p) => (p.Name || p.Player || p.id || "").length > 0)
  .map((p) => {
    const name = p.Name || p.Player || p.name || "";
    const id = p.ID || p.Id || p.id || name;
    const team = p.Team || p.team || "";
    const power = Number(p.Power || p.power || 0);
    const active = String(p.Active || p.active || "").toLowerCase();
    const isActive = active === "1" || active === "true" || active === "yes";

    return { id, name, team, power, active: isActive };
  })
  .sort((a, b) => b.power - a.power);

const payload = {
  meta: {
    builtAtISO: now,
    episode: EP, // null if not provided
    source: "players.csv",
  },
  rankings,
};

// 3) write main outputs
writeJSON(outPath, payload);

// shift prev
const prev = safeReadJSON(outPath);
if (prev) writeJSON(prevOutPath, prev);

// 4) archive snapshot
// ✅ deterministic rebuild: always archive to rankings_ep_###.json
if (EP !== null) {
  const snapPath = path.join(archiveDir, `rankings_ep_${pad3(EP)}.json`);
  writeJSON(snapPath, payload);
  console.log(`Archived EP snapshot: ${path.relative(root, snapPath)}`);
  process.exit(0);
}

// ✅ original “timestamp archive” behavior but still prevents useless spam
// (you can keep your old logic here if you want; simplest safe version:)
const ts = now.replace(/[:.]/g, "-");
const archivePath = path.join(archiveDir, `rankings_${ts}.json`);

// Only archive if different from latest timestamp snapshot
const files = fs
  .readdirSync(archiveDir)
  .filter((f) => f.startsWith("rankings_") && f.endsWith(".json"))
  .map((f) => path.join(archiveDir, f))
  .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

const latest = files.length ? safeReadJSON(files[files.length - 1]) : null;

if (latest && stableStringify(latest.rankings) === stableStringify(payload.rankings)) {
  console.log("Snapshot NOT archived (identical rankings).");
} else {
  writeJSON(archivePath, payload);
  console.log("Archived:", path.relative(root, archivePath));
}
