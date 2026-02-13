import fs from "fs";
import path from "path";

const root = process.cwd();

const snapshotsDir = path.join(root, "src", "data", "rebuild_players");
const fallbackInPath = path.join(root, "src", "data", "players.csv");
const outPath = path.join(root, "src", "data", "players.json");

function listPlayerSnapshots() {
  try {
    if (!fs.existsSync(snapshotsDir)) return [];
    return fs
      .readdirSync(snapshotsDir)
      .filter((f) => /^players_ep_\d{3}\.csv$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

function pickLatestSnapshotPath() {
  const files = listPlayerSnapshots();
  if (!files.length) return null;

  let best = { ep: -1, file: "" };
  for (const f of files) {
    const m = f.match(/^players_ep_(\d{3})\.csv$/i);
    if (!m) continue;
    const ep = Number(m[1]);
    if (Number.isFinite(ep) && ep > best.ep) best = { ep, file: f };
  }
  if (best.ep < 0) return null;
  return { ep: best.ep, path: path.join(snapshotsDir, best.file), file: best.file };
}

// ---------------- DELIMITER + CSV/TSV PARSER ----------------
function detectDelimiter(headerLine) {
  const counts = {
    "\t": (headerLine.match(/\t/g) || []).length,
    ",": (headerLine.match(/,/g) || []).length,
    ";": (headerLine.match(/;/g) || []).length,
  };

  // Pick the delimiter with the highest count
  let best = "\t";
  for (const k of Object.keys(counts)) {
    if (counts[k] > counts[best]) best = k;
  }
  return best;
}

function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    // escaped quote inside quotes
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    // toggle quotes
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    // delimiter
    if (ch === delim && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    // newline
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

  return { rows, delim };
}

// ---------------- NORMALIZATION + PARSERS ----------------
function normKey(h) {
  // Keep underscores, normalize spaces, lowercase
  // Strip % from header keys so "Win%" becomes "win"
  return String(h ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/%/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[^\w ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(x) {
  if (x === null || x === undefined) return null;
  const s = String(x)
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ✅ percent parser: "77.78%" -> 0.7778, "77.78" -> 0.7778, "0.77" -> 0.77
function toPercent(x) {
  if (x === null || x === undefined) return null;

  const raw = String(x).trim().replace(/\u00a0/g, " ");
  if (!raw) return null;

  if (raw.includes("%")) {
    const n = toNumber(raw.replace(/%/g, ""));
    return n == null ? null : n / 100;
  }

  const n = toNumber(raw);
  if (n == null) return null;

  return n > 1 ? n / 100 : n;
}

function get(obj, keys) {
  for (const k of keys) {
    const kk = normKey(k);
    const v = obj[kk];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// ---------------- ROW MAPPER ----------------
function buildRow(obj, currentEp) {
  // Your exact headers:
  // PlayerID	PlayerName	Team	TotalDuels	Wins	Win%	ArriveFirst%	FinalPtsPlayed	FinalPtsWon
  // ... Reliability PowerRating Adjusted PR EliminatedEpisode

  const id = get(obj, ["PlayerID"]);
  const name = get(obj, ["PlayerName"]);
  const team = get(obj, ["Team"]);

  if (!id || !name || !team) return null;

  const wins = toNumber(get(obj, ["Wins"])) ?? 0;
  const duels = toNumber(get(obj, ["TotalDuels"])) ?? 0;

  // ✅ percent fields (stored like "77.78%")
  const winPct = toPercent(get(obj, ["Win%"])) ?? null;
  const arriveFirstPct = toPercent(get(obj, ["ArriveFirst%"])) ?? null;

  const finalPtsPlayed = toNumber(get(obj, ["FinalPtsPlayed"])) ?? null;
  const finalPtsWon = toNumber(get(obj, ["FinalPtsWon"])) ?? null;

  const clutch = toNumber(get(obj, ["ClutchRating"])) ?? null;

  // Some are percent fields, but you can keep them numeric.
  // If you later display these as % in UI, swap to toPercent(...)
  const choke = toPercent(get(obj, ["ChokeRate_WhenArrivedFirst"])) ?? null;

  const reliability = toNumber(get(obj, ["Reliability"])) ?? null;

  // Power columns (important)
  const power = toNumber(get(obj, ["PowerRating"])) ?? null;
  const power_adj = toNumber(get(obj, ["Adjusted PR"])) ?? null; // ✅ keep as number

  const eliminatedEpisode = toNumber(get(obj, ["EliminatedEpisode"])) ?? null;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    wins,
    duels,

    winPct, // fraction 0..1
    arriveFirstPct, // fraction 0..1

    finalPtsPlayed,
    finalPtsWon,

    clutch,
    choke,

    reliability,

    power,
    power_adj,

    eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
    isEliminated: eliminatedEpisode != null ? currentEp >= eliminatedEpisode : false,
  };
}

// ---------------- RUN ----------------
const snap = pickLatestSnapshotPath();

let inPath = fallbackInPath;
let currentEp = 0;

if (snap) {
  inPath = snap.path;
  currentEp = snap.ep;
  console.log(`Using snapshot: src/data/rebuild_players/${snap.file} (EP ${snap.ep})`);
} else {
  console.log(`No players_ep_### snapshots found. Falling back to: ${inPath}`);
}

if (!fs.existsSync(inPath)) {
  console.error("Input file not found:", inPath);
  process.exit(1);
}

const text = fs.readFileSync(inPath, "utf8");
const { rows, delim } = parseDelimited(text);

if (rows.length < 2) {
  console.error("Input looks empty (need header + at least 1 row). Not writing players.json.");
  process.exit(1);
}

console.log(`Detected delimiter: ${delim === "\t" ? "TAB" : delim}`);

const headers = rows[0].map(normKey);

const data = rows
  .slice(1)
  .map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return buildRow(obj, currentEp);
  })
  .filter(Boolean);

// Safety: don't overwrite a good file with []
if (!data.length) {
  const prev = safeReadJSON(outPath);
  console.error("❌ Parsed 0 players from snapshot. Keeping existing players.json.");
  console.error("Headers (normalized):", headers.join(" | "));
  if (Array.isArray(prev)) console.error(`Existing players.json has ${prev.length} rows (kept).`);
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Wrote ${data.length} rows to src/data/players.json`);
