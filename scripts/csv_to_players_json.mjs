import fs from "fs";
import path from "path";

const root = process.cwd();
const inPath = path.join(root, "src", "data", "players.csv");
const outPath = path.join(root, "src", "data", "players.json");

console.log("Reading:", inPath);
console.log("Writing:", outPath);

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

// Map a Player_Summary row -> players.json row
function mapRow(obj) {
  const id = pick(obj, ["playerid", "id", "player_id"]);
  const name = pick(obj, ["playername", "player_name", "name"]);
  const team = pick(obj, ["team", "team_name"]);

  if (!id || !name || !team) return null;

  const wins = toNumber(pick(obj, ["wins", "wins_total"])) ?? 0;
  const duels = toNumber(pick(obj, ["totalduels", "duels", "total_duels"])) ?? 0;

  // Win% header might normalize to "winpct" OR remain "win" if your header is "Win%"
  const winPct =
    toNumber(pick(obj, ["winpct", "win", "win_percentage", "win_percent"])) ?? null;

  const clutch = toNumber(pick(obj, ["clutchrating", "clutch_rating"])) ?? null;

  const choke =
    toNumber(
      pick(obj, [
        "chokerate_whenarrivedfirst",
        "chokerate",
        "choke_rate",
        "choke",
      ])
    ) ?? null;

  const reliability = toNumber(pick(obj, ["reliability"])) ?? null;

  // ✅ NEW STATS (from your CSV headers)
  // Players.csv columns (after normalizeHeader):
  // ArriveFirst%      -> arrivefirstpct
  // FinalPtsPlayed    -> finalptsplayed
  // FinalPtsWon       -> finalptswon
  // TiebreakPlayed    -> tiebreakplayed
  // TiebreakWon       -> tiebreakwon
  const arriveFirstPct =
    toNumber(pick(obj, ["arrivefirstpct", "arrive_firstpct", "arrive_first_pct"])) ?? null;

  const finalPtsPlayed =
    toNumber(pick(obj, ["finalptsplayed", "final_ptsplayed", "final_pts_played"])) ?? null;

  const finalPtsWon =
    toNumber(pick(obj, ["finalptswon", "final_pts_won", "final_pts_won"])) ?? null;

  const tiebreakPlayed =
    toNumber(pick(obj, ["tiebreakplayed", "tiebreakplayed", "tiebreaksplayed"])) ?? null;

  const tiebreakWon =
    toNumber(pick(obj, ["tiebreakwon", "tiebreakwon", "tiebreakswon"])) ?? null;

  const tiebreakWinPct =
    tiebreakPlayed != null && tiebreakWon != null && tiebreakPlayed > 0
      ? (tiebreakWon / tiebreakPlayed) * 100
      : null;

  // ✅ UNIVERSAL DISPLAY POWER = Adjusted PR
  const powerAdj =
    toNumber(
      pick(obj, ["adjusted_pr", "adjustedpr", "adjusted_power", "adjusted_rating"])
    ) ?? null;

  const powerRaw =
    toNumber(pick(obj, ["powerrating", "power_rating", "power"])) ?? null;

  const power = powerAdj != null ? powerAdj : powerRaw;

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    team: String(team).trim(),

    wins,
    duels,
    winPct,

    clutch,
    choke,
    reliability,

    // ✅ NEW STATS
    arriveFirstPct: arriveFirstPct == null ? null : Number(arriveFirstPct.toFixed(2)),
    finalPtsPlayed: finalPtsPlayed == null ? null : Math.round(finalPtsPlayed),
    finalPtsWon: finalPtsWon == null ? null : Math.round(finalPtsWon),
    tiebreakPlayed: tiebreakPlayed == null ? null : Math.round(tiebreakPlayed),
    tiebreakWon: tiebreakWon == null ? null : Math.round(tiebreakWon),
    tiebreakWinPct: tiebreakWinPct == null ? null : Number(tiebreakWinPct.toFixed(2)),

    // ✅ Universal power used across the site
    power: power == null ? null : Number(power.toFixed(2)),

    // Optional debugging / future analytics
    power_adj: powerAdj == null ? null : Number(powerAdj.toFixed(2)),
    power_raw: powerRaw == null ? null : Number(powerRaw.toFixed(2)),
  };
}

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

const data = rows
  .slice(1)
  .map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return mapRow(obj);
  })
  .filter(Boolean);

fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log(`✅ Wrote ${data.length} rows to ${outPath}`);
