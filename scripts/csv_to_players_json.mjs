import fs from "fs";
import path from "path";

const root = process.cwd();
const inPath = path.join(root, "src", "data", "players.csv");
const outPath = path.join(root, "src", "data", "players.json");

// Used only to compute "current episode" (snapshot count)
const archiveDir = path.join(root, "src", "data", "archive");

console.log("Reading:", inPath);
console.log("Writing:", outPath);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listSnapshotFiles() {
  try {
    if (!fs.existsSync(archiveDir)) return [];
    return fs
      .readdirSync(archiveDir)
      .filter((f) => /^rankings_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.json$/.test(f));
  } catch {
    return [];
  }
}

// Episodes are built from *transitions* between snapshots.
// When we are about to produce the next snapshot, the "current episode number" is:
//   currentEpisode = existingSnapshotsCount
function getCurrentEpisodeNumber() {
  const snaps = listSnapshotFiles();
  return snaps.length + 1; // ✅
}

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// ---------------- CSV PARSER ----------------
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

// Stronger normalization (matches rankings builder)
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

function numOrNull(x) {
  const n = toNumber(x);
  return n == null ? null : n;
}

function round2(n) {
  return n == null ? null : Number(n.toFixed(2));
}

// Map a Player_Summary row -> players.json row
function mapRow(obj, currentEpisode) {
  const id = pick(obj, ["playerid", "id", "player_id"]);
  const name = pick(obj, ["playername", "player_name", "name"]);
  const team = pick(obj, ["team", "team_name"]);

  if (!id || !name || !team) return null;

  const wins = toNumber(pick(obj, ["wins", "wins_total"])) ?? 0;
  const duels = toNumber(pick(obj, ["totalduels", "duels", "total_duels"])) ?? 0;

  const winPct =
    toNumber(pick(obj, ["winpct", "win", "win_percentage", "win_percent"])) ?? null;

  const arriveFirstPct =
    toNumber(pick(obj, ["arrivefirstpct", "arrive_first_pct", "arrive_first"])) ?? null;

  const finalPtsPlayed =
    toNumber(pick(obj, ["finalptsplayed", "final_pts_played", "final_points_played"])) ?? null;

  const finalPtsWon =
    toNumber(pick(obj, ["finalptswon", "final_pts_won", "final_points_won"])) ?? null;

  const tiebreakPlayed =
    toNumber(pick(obj, ["tiebreakplayed", "tiebreak_played"])) ?? null;

  const tiebreakWon =
    toNumber(pick(obj, ["tiebreakwon", "tiebreak_won"])) ?? null;

  const tiebreakWinPct =
    toNumber(pick(obj, ["tiebreakwinpct", "tiebreak_win_pct"])) ?? null;

  const clutch =
    toNumber(pick(obj, ["clutchrating", "clutch_rating", "smoothed_clutch"])) ?? null;

  const choke =
    toNumber(
      pick(obj, [
        "shrunkchokerate_whenarrivedfirst",
        "chokerate_whenarrivedfirst",
        "chokerate",
        "choke_rate",
        "choke",
      ])
    ) ?? null;

  const reliability = toNumber(pick(obj, ["reliability"])) ?? null;

  // ✅ UNIVERSAL DISPLAY POWER = Adjusted PR
  const powerAdj =
    toNumber(
      pick(obj, ["adjusted_pr", "adjustedpr", "adjusted_power", "adjusted_rating"])
    ) ?? null;

  const powerRaw =
    toNumber(pick(obj, ["powerrating", "power_rating", "power"])) ?? null;

  const power = powerAdj != null ? powerAdj : powerRaw;

  // -------- NEW (optional) stats (pass-through if present in CSV) --------
  const sos =
    toNumber(
      pick(obj, [
        "sos",
        "strength_of_schedule",
        "opponentdifficulty",
        "opponent_difficulty",
        "avg_opponent_power",
        "avg_opponent_power_norm",
        "norm_opp_diff",
        "norm_oppdifficulty",
      ])
    ) ?? null;

  const pressureWeightedSos =
    toNumber(
      pick(obj, [
        "pressure_weighted_sos",
        "pressureweightedsos",
        "pressure_weighted_opponentdifficulty",
        "pressure_weighted_opp_diff",
      ])
    ) ?? null;

  const closeLossRate =
    toNumber(pick(obj, ["closelossrate", "close_loss_rate"])) ?? null;

  const pressureWinPct =
    toNumber(
      pick(obj, [
        "pressurewinpct",
        "pressure_win_pct",
        "pressureadjwinpct",
        "pressure_adj_winpct",
        "pressureadjwin",
      ])
    ) ?? null;

  const marginVolatility =
    toNumber(
      pick(obj, [
        "marginvolatility",
        "margin_volatility",
        "std_norm_margin",
        "stddev_norm_margin",
        "volatility_of_performance",
      ])
    ) ?? null;

  const rollingWinPct5 =
    toNumber(pick(obj, ["rollingwinpct5", "rolling_win_pct_5", "last5winpct"])) ?? null;

  const rollingWinPct8 =
    toNumber(pick(obj, ["rollingwinpct8", "rolling_win_pct_8", "last8winpct"])) ?? null;

  const pressureWeightedAvgNormMargin =
    toNumber(
      pick(obj, [
        "pressure_weighted_avg_normalized_margin",
        "pressure_weighted_avg_norm_margin",
      ])
    ) ?? null;

  // -------- Elimination signal --------
  const eliminatedEpisode =
    toNumber(pick(obj, ["eliminatedepisode", "eliminated_episode", "eliminated_ep"])) ??
    null;

  // Consider eliminated as soon as currentEpisode >= eliminatedEpisode
  const isEliminated =
    eliminatedEpisode != null && Number.isFinite(eliminatedEpisode)
      ? currentEpisode >= eliminatedEpisode
      : false;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    wins,
    duels,
    winPct,

    arriveFirstPct,
    finalPtsPlayed,
    finalPtsWon,
    tiebreakPlayed,
    tiebreakWon,
    tiebreakWinPct,

    clutch,
    choke,
    reliability,

    // ✅ Universal power used across the site
    power: power == null ? null : round2(power),

    // Optional debugging / future analytics
    power_adj: powerAdj == null ? null : round2(powerAdj),
    power_raw: powerRaw == null ? null : round2(powerRaw),

    // ✅ new optional stats
    sos: sos == null ? null : round2(sos),
    pressureWeightedSos: pressureWeightedSos == null ? null : round2(pressureWeightedSos),
    closeLossRate: closeLossRate == null ? null : round2(closeLossRate),
    pressureWinPct: pressureWinPct == null ? null : round2(pressureWinPct),
    marginVolatility: marginVolatility == null ? null : round2(marginVolatility),
    rollingWinPct5: rollingWinPct5 == null ? null : round2(rollingWinPct5),
    rollingWinPct8: rollingWinPct8 == null ? null : round2(rollingWinPct8),
    pressureWeightedAvgNormMargin:
      pressureWeightedAvgNormMargin == null ? null : round2(pressureWeightedAvgNormMargin),

    eliminatedEpisode: eliminatedEpisode == null ? null : Math.round(eliminatedEpisode),
    isEliminated,
  };
}

if (!fs.existsSync(inPath)) {
  console.error(`Missing file: ${inPath}`);
  process.exit(1);
}

const currentEpisode = getCurrentEpisodeNumber();
console.log(`ℹ️ Current episode number (derived from snapshots): ${currentEpisode}`);

const csvText = fs.readFileSync(inPath, "utf8");
const rows = parseCSV(csvText);

if (rows.length < 2) {
  console.error("CSV looks empty (need header + at least 1 row).");
  process.exit(1);
}

const headers = rows[0].map(normalizeHeader);

// Load previous players.json to allow freezing eliminated players
const prevData = safeReadJSON(outPath);
const prevMap = new Map();
if (Array.isArray(prevData)) {
  for (const r of prevData) {
    if (r?.id != null) prevMap.set(String(r.id), r);
  }
}

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
  const elimEp = numOrNull(r?.eliminatedEpisode);
  if (elimEp == null) return r;

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

  // ensure flags exist
  return {
    ...r,
    eliminatedEpisode: Math.round(elimEp),
    isEliminated: currentEpisode >= elimEp,
  };
});

fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Wrote ${data.length} rows to ${outPath}`);
