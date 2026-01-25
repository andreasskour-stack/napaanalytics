import fs from "fs";
import path from "path";

const root = process.cwd();

const scorePath = path.join(root, "src", "data", "h2h_score.csv");
const domPath = path.join(root, "src", "data", "h2h_dom.csv"); // optional
const outPath = path.join(root, "src", "data", "h2h.json");

// ---------- CSV PARSER ----------
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

function toNum(x) {
  if (x == null) return null;
  const s = String(x).trim().replace(/\u00A0/g, " ").replace(/\s+/g, "");
  if (!s) return null;
  const n = Number(s.replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function parseScoreCell(s) {
  const txt = String(s ?? "").trim();
  if (!txt) return null;

  // supports "2-0" or "2–0"
  const m = txt.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!m) return null;

  const aWins = Number(m[1]);
  const bWins = Number(m[2]);
  const total = aWins + bWins;

  const aPct = total > 0 ? (aWins / total) * 100 : null;
  const bPct = total > 0 ? (bWins / total) * 100 : null;

  return { aWins, bWins, aPct, bPct, total, raw: `${aWins}-${bWins}` };
}

function loadMatrix(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const txt = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCSV(txt);

  if (rows.length < 3) return null;

  // row0: [ , PlayerID, 13,14,...]
  // row1: [PlayerID, PlayerName..., Name13,Name14,...]
  const colIds = rows[0].slice(2).map((x) => String(x).trim());
  const colNames = rows[1].slice(2).map((x) => String(x).trim());

  const rowIds = [];
  const rowNames = [];
  const data = [];

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const rid = String(r[0] ?? "").trim();
    const rname = String(r[1] ?? "").trim();
    if (!rid) continue;

    rowIds.push(rid);
    rowNames.push(rname);

    data.push(r.slice(2));
  }

  return { colIds, colNames, rowIds, rowNames, data };
}

function buildPlayersIndex(scoreM, domM) {
  const players = {};

  if (scoreM) {
    scoreM.rowIds.forEach((id, idx) => {
      players[id] = players[id] ?? { id, name: scoreM.rowNames[idx] ?? "" };
      if (!players[id].name) players[id].name = scoreM.rowNames[idx] ?? "";
    });
    scoreM.colIds.forEach((id, idx) => {
      players[id] = players[id] ?? { id, name: scoreM.colNames[idx] ?? "" };
      if (!players[id].name) players[id].name = scoreM.colNames[idx] ?? "";
    });
  }

  if (domM) {
    domM.rowIds.forEach((id, idx) => {
      players[id] = players[id] ?? { id, name: domM.rowNames[idx] ?? "" };
      if (!players[id].name) players[id].name = domM.rowNames[idx] ?? "";
    });
    domM.colIds.forEach((id, idx) => {
      players[id] = players[id] ?? { id, name: domM.colNames[idx] ?? "" };
      if (!players[id].name) players[id].name = domM.colNames[idx] ?? "";
    });
  }

  return players;
}

// ---------- MAIN ----------
if (!fs.existsSync(scorePath)) {
  console.error(`Missing file: ${scorePath}`);
  process.exit(1);
}

const scoreM = loadMatrix(scorePath);
const domM = loadMatrix(domPath); // optional (null if missing)

if (!scoreM) {
  console.error("Score matrix CSV couldn't be parsed.");
  process.exit(1);
}

const players = buildPlayersIndex(scoreM, domM);

// Build lookup: key = "rowId|colId"
const score = {};
for (let i = 0; i < scoreM.rowIds.length; i++) {
  const rowId = scoreM.rowIds[i];
  for (let j = 0; j < scoreM.colIds.length; j++) {
    const colId = scoreM.colIds[j];
    const cell = scoreM.data[i]?.[j];
    const parsed = parseScoreCell(cell);
    if (!parsed) continue;

    const key = `${rowId}|${colId}`;
    score[key] = parsed;
  }
}

// Dominance lookup (numeric cell): key = "rowId|colId"
const dominance = {};
if (domM) {
  for (let i = 0; i < domM.rowIds.length; i++) {
    const rowId = domM.rowIds[i];
    for (let j = 0; j < domM.colIds.length; j++) {
      const colId = domM.colIds[j];
      const cell = domM.data[i]?.[j];
      const n = toNum(cell);
      if (n == null) continue;
      const key = `${rowId}|${colId}`;
      dominance[key] = Number(n.toFixed(4));
    }
  }
}

const out = {
  meta: {
    generatedAtISO: new Date().toISOString(),
    scoreSource: path.relative(root, scorePath),
    dominanceSource: fs.existsSync(domPath) ? path.relative(root, domPath) : null,
  },
  players, // { [id]: {id, name} }
  score, // { "row|col": {aWins,bWins,aPct,bPct,total,raw} }
  dominance, // { "row|col": number } optional
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`✅ Wrote h2h.json to ${outPath}`);
console.log(`ℹ️ Score pairs: ${Object.keys(score).length}`);
console.log(`ℹ️ Dominance pairs: ${Object.keys(dominance).length}`);
