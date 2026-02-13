import fs from "fs";
import path from "path";

const root = process.cwd();
const rebuildDir = path.join(root, "src", "data", "rebuild_players");

const outPath = path.join(root, "src", "data", "rankings.json");
const prevOutPath = path.join(root, "src", "data", "rankings.prev.json");
const archiveDir = path.join(root, "src", "data", "archive");

const EPS_POWER = 0.05;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function toNumber(x) {
  const n = Number(String(x ?? "").replace(",", ".")); // allow "12,34"
  return Number.isFinite(n) ? n : 0;
}

// ---------- CSV parsing (auto-detect delimiter) ----------
function detectDelimiter(headerLine) {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;

  if (semi >= comma && semi >= tab && semi > 0) return ";";
  if (tab >= comma && tab >= semi && tab > 0) return "\t";
  return ","; // default
}

function parseLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // escaped quote
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);

  return out.map((s) => s.trim());
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, ""); // strip weird chars
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const text = raw.replace(/^\uFEFF/, "").trim(); // remove BOM
  if (!text) return { headers: [], rows: [], delimiter: "," };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [], delimiter: "," };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  const normHeaders = headers.map(normalizeHeader);

  const rows = lines.slice(1).map((line) => {
    const cols = parseLine(line, delimiter);
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[normHeaders[i]] = (cols[i] ?? "").trim();
    }
    return obj;
  });

  return { headers: normHeaders, rows, delimiter };
}

function get(row, keys) {
  for (const k of keys) {
    const v = row[normalizeHeader(k)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

// ---------- Snapshot selection ----------
function findEpisodeFiles() {
  if (!fs.existsSync(rebuildDir)) return [];
  const files = fs.readdirSync(rebuildDir);

  const matches = [];
  for (const f of files) {
    const m = f.match(/^players_ep_(\d+)\.csv$/i);
    if (!m) continue;
    matches.push({
      file: f,
      ep: Number(m[1]),
      fullPath: path.join(rebuildDir, f),
    });
  }

  matches.sort((a, b) => a.ep - b.ep);
  return matches;
}

function computeTrend(currPower, prevPower) {
  const d = currPower - prevPower;
  if (d > EPS_POWER) return "up";
  if (d < -EPS_POWER) return "down";
  return "flat";
}

// ---------- Normalize snapshot row into RankingRow ----------
function normalizeRow(row) {
  // row keys are already normalized (lowercase, cleaned)

  const id = get(row, ["id", "playerid", "player id", "player_id"]);
  const name = get(row, ["name", "player", "player name", "playername"]);
  const team = get(row, ["team", "teamname", "team name"]);

  // ✅ Prefer adjusted power first (column to the right in your CSV)
  // Add multiple guesses because Excel headers vary a lot.
  const adjustedRaw = get(row, [
    "adjusted",
    "Adjusted PR",
    "adjusted power",
    "power adjusted",
    "adjustedpower",
    "adj power",
    "adjpower",
    "power adj",
    "poweradj",
    "adjusted pow",
    "adjusted rating",
    "rating adjusted",
  ]);

  const baseRaw = get(row, [
    "power",
    "currentpower",
    "power rating",
    "powerrating",
    "power score",
    "rating",
  ]);

  const chosen = (String(adjustedRaw).trim() !== "" ? adjustedRaw : baseRaw);

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),
    power: toNumber(chosen),
  };
}


// ---------- MAIN ----------
ensureDir(archiveDir);

const files = findEpisodeFiles();
if (!files.length) {
  console.error("No snapshot CSVs found in:", rebuildDir);
  console.error('Expected files like: "players_ep_011.csv"');
  process.exit(1);
}

const EP = process.env.EPISODE ? Number(process.env.EPISODE) : null;
const latest = EP !== null ? files.find((x) => x.ep === EP) : files[files.length - 1];

if (!latest) {
  console.error("Requested EPISODE not found:", EP);
  console.error("Available episodes:", files.map((x) => x.ep).join(", "));
  process.exit(1);
}

const prev = files.slice().reverse().find((x) => x.ep < latest.ep) ?? null;

// Read latest
const currCSV = readCSV(latest.fullPath);
const currNorm = currCSV.rows.map(normalizeRow);

// keep rows that have at least id or name (we’ll debug if missing)
const currRows = currNorm.filter((r) => r.id || r.name);

// Read prev
let prevById = new Map();
let prevOut = [];
if (prev) {
  const prevCSV = readCSV(prev.fullPath);
  const prevNorm = prevCSV.rows.map(normalizeRow);
  const prevRows = prevNorm.filter((r) => r.id || r.name);
  prevById = new Map(prevRows.map((r) => [String(r.id), r]));
  prevOut = prevRows.map((r) => ({ ...r, trend: "flat" }));
}
writeJSON(prevOutPath, prevOut);

// If still 0 usable rows, print debug and fail hard (better than silent empty data)
if (!currRows.length) {
  console.error("Parsed 0 usable rows from:", latest.fullPath);
  console.error("Detected delimiter:", JSON.stringify(currCSV.delimiter));
  console.error("Detected headers:", currCSV.headers);
  console.error("Sample raw row object (first row):", currCSV.rows[0] ?? null);
  console.error(
    "Fix: ensure your CSV has columns for id/name/team/power (any header spelling is OK), and delimiter is auto-detected."
  );
  process.exit(1);
}

// Compute final rankings array
const rankings = currRows
  .map((r) => {
    const prevRow = r.id ? prevById.get(String(r.id)) : null;
    const prevPower = prevRow ? prevRow.power : r.power;
    const trend = computeTrend(r.power, prevPower);

    return {
      id: r.id || "", // MUST exist ideally
      name: r.name || "",
      team: r.team || "",
      power: r.power,
      trend,
    };
  })
  // keep only rows with id+name for the UI to behave properly
  .filter((r) => r.id && r.name)
  .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

writeJSON(outPath, rankings);

const snapPath = path.join(archiveDir, `rankings_ep_${pad3(latest.ep)}.json`);
writeJSON(snapPath, {
  meta: {
    builtAtISO: new Date().toISOString(),
    episode: latest.ep,
    source: path.relative(root, latest.fullPath),
    prevEpisode: prev?.ep ?? null,
    delimiter: currCSV.delimiter,
  },
  rankings,
});

console.log(`Using snapshot: ${path.relative(root, latest.fullPath)} (EP ${latest.ep})`);
console.log(`Wrote ${path.relative(root, outPath)} (${rankings.length} rows)`);
console.log(`Wrote ${path.relative(root, prevOutPath)} (${prev ? "from EP " + prev.ep : "empty"})`);
console.log(`Archived ${path.relative(root, snapPath)}`);
