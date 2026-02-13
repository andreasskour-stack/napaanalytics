import fs from "fs";
import path from "path";

const root = process.cwd();
const snapshotsDir = path.join(root, "src", "data", "rebuild_players");
const archiveDir = path.join(root, "src", "data", "archive");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function detectDelimiter(line) {
  const counts = {
    "\t": (line.match(/\t/g) || []).length,
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
  };
  let best = "\t";
  for (const k of Object.keys(counts)) if (counts[k] > counts[best]) best = k;
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

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
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

  return { rows, delim };
}

function normKey(h) {
  return String(h ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(x) {
  if (x === null || x === undefined) return null;
  const raw = String(x).trim().replace(/\u00a0/g, " ");
  if (!raw) return null;

  // strip % but keep numeric
  const s = raw.replace(/%/g, "").replace(/\s+/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickValue(obj, keys) {
  for (const k of keys) {
    const kk = normKey(k);
    const v = obj[kk];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

/**
 * Build the "rankings row" shape expected by your UI + build_episodes.
 * We prioritize:
 *  - id
 *  - name
 *  - team
 *  - power = Adjusted PR (your new truth)
 *  - trend: default "flat" (episodes builder compares snapshots, it can derive deltas)
 */
function buildRankingRow(obj) {
  const id = pickValue(obj, ["PlayerID", "id"]);
  const name = pickValue(obj, ["PlayerName", "name"]);
  const team = pickValue(obj, ["Team", "team"]);

  if (!id || !name || !team) return null;

  const powerAdj = toNumber(pickValue(obj, ["Adjusted PR", "AdjustedPR", "adjusted pr"]));
  const powerRaw = toNumber(pickValue(obj, ["PowerRating", "Power Rating", "power"]));

  const eliminatedEpisode = toNumber(pickValue(obj, ["EliminatedEpisode", "Eliminated Episode"])) ?? null;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),
    power: (powerAdj ?? powerRaw ?? 0),
    trend: "flat",
    eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
    isEliminated: eliminatedEpisode != null && eliminatedEpisode > 0,
  };
}

function loadSnapshot(ep) {
  const fname = `players_ep_${String(ep).padStart(3, "0")}.csv`;
  const p = path.join(snapshotsDir, fname);
  if (!fs.existsSync(p)) return null;

  const text = fs.readFileSync(p, "utf8");
  const { rows } = parseDelimited(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normKey);

  const data = rows
    .slice(1)
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
      return buildRankingRow(obj);
    })
    .filter(Boolean);

  return data;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeArchive(ep, data) {
  ensureDir(archiveDir);
  const out = path.join(archiveDir, `rankings_ep_${String(ep).padStart(3, "0")}.json`);
  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ Wrote ${path.relative(root, out)} (${data.length} rows)`);
}

// ---- MAIN ----
const args = process.argv.slice(2);
if (args.length === 0) {
  die(`Usage:
  node scripts/backfill_rankings_archive.mjs 16 17
or:
  node scripts/backfill_rankings_archive.mjs 0-18
`);
}

function parseEps(args) {
  const eps = new Set();
  for (const a of args) {
    const s = String(a).trim();
    if (!s) continue;
    if (s.includes("-")) {
      const [A, B] = s.split("-").map((x) => Number(x.trim()));
      const lo = Math.min(A, B);
      const hi = Math.max(A, B);
      for (let e = lo; e <= hi; e++) eps.add(e);
    } else {
      eps.add(Number(s));
    }
  }
  return Array.from(eps).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

const eps = parseEps(args);

for (const ep of eps) {
  const data = loadSnapshot(ep);
  if (data === null) {
    console.warn(`⚠️ Missing snapshot players_ep_${String(ep).padStart(3, "0")}.csv (skipped)`);
    continue;
  }
  if (!data.length) {
    console.warn(`⚠️ Snapshot EP${ep} parsed 0 rows (skipped)`);
    continue;
  }
  writeArchive(ep, data);
}

console.log("Done.");
