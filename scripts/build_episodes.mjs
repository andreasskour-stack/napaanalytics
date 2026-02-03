import fs from "fs";
import path from "path";

const root = process.cwd();
const archiveDir = path.join(root, "src", "data", "archive");
const outPath = path.join(root, "src", "data", "episodes.json");

// ✅ duels source (TSV/CSV)
const duelsPath = path.join(root, "src", "data", "duels.csv");

/* =========================
   Helpers
========================= */
function safeNum(x, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Prefer Adjusted PR if available (power_adj), else fallback to power, else power_raw.
function getDisplayPower(r) {
  const a = safeNum(r?.power_adj, NaN);
  if (Number.isFinite(a)) return a;

  const p = safeNum(r?.power, NaN);
  if (Number.isFinite(p)) return p;

  const raw = safeNum(r?.power_raw, NaN);
  if (Number.isFinite(raw)) return raw;

  return 0;
}

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function parseStampFromFilename(file) {
  const m = file.match(
    /rankings_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})\.json$/
  );
  if (!m) return null;

  const [_, ymd, hh, mm, ss, ms] = m;
  const iso = `${ymd}T${hh}:${mm}:${ss}.${ms}Z`;
  const d = new Date(iso);

  return Number.isFinite(d.getTime()) ? d : null;
}

function makeIdFromFile(file) {
  return file.replace(/^rankings_/, "").replace(/\.json$/, "");
}

/* =========================
   Movers / diffs
========================= */
function computeDiff(prevRows, currRows) {
  const prevMap = new Map();
  for (const p of prevRows || []) {
    if (!p || p.id == null) continue;
    prevMap.set(String(p.id), p);
  }

  const diffs = [];
  for (const c of currRows || []) {
    if (!c || c.id == null) continue;

    const prev = prevMap.get(String(c.id));
    const currPower = getDisplayPower(c);
    const prevPower = prev ? getDisplayPower(prev) : null;

    const delta =
      prevPower == null || !Number.isFinite(prevPower)
        ? null
        : Number((currPower - prevPower).toFixed(2));

    diffs.push({
      id: String(c.id),
      name: String(c.name ?? "").trim(),
      team: String(c.team ?? "").trim(),
      currPower: Number(currPower.toFixed(2)),
      prevPower:
        prevPower == null || !Number.isFinite(prevPower)
          ? null
          : Number(prevPower.toFixed(2)),
      delta,
    });
  }

  return diffs;
}

function topMovers(diffs, dir, n = 5) {
  const arr = diffs
    .filter((d) => d.delta != null && Number.isFinite(d.delta))
    .slice()
    .sort((a, b) => (dir === "up" ? b.delta - a.delta : a.delta - b.delta));
  return arr.slice(0, n);
}

function byTeam(diffs, team) {
  return diffs.filter(
    (d) =>
      String(d.team).trim().toLowerCase() === String(team).trim().toLowerCase()
  );
}

function computeTeamSwing(diffs) {
  const sum = (arr) =>
    arr.reduce(
      (acc, d) =>
        acc + (d.delta != null && Number.isFinite(d.delta) ? d.delta : 0),
      0
    );

  const athArr = byTeam(diffs, "Athinaioi");
  const epaArr = byTeam(diffs, "Eparxiotes");

  const athSum = Number(sum(athArr).toFixed(2));
  const epaSum = Number(sum(epaArr).toFixed(2));

  const athN = athArr.length;
  const epaN = epaArr.length;

  const athAvg = athN > 0 ? athSum / athN : 0;
  const epaAvg = epaN > 0 ? epaSum / epaN : 0;

  let winner = "Draw";
  if (athSum > epaSum) winner = "Athinaioi";
  else if (epaSum > athSum) winner = "Eparxiotes";

  return {
    teams: {
      Athinaioi: { sum: athSum, avg: athAvg, n: athN },
      Eparxiotes: { sum: epaSum, avg: epaAvg, n: epaN },
    },
    winner,
    margin: Number(Math.abs(athSum - epaSum).toFixed(2)),
  };
}

/* =========================
   Episode labeling / mapping
========================= */

// Keep your skip set exactly as you had it (dev/test snapshots)
const SKIP_EPISODES = new Set([2, 4, 5, 6]);

// ✅ EXTENDED: add 13 + 14
const EPISODE_LABELS = {
  1: "Opening Phase (Ep 1–7)",
  3: "Episode 8",
  7: "Episode 9",
  8: "Episode 10",
  9: "Episode 11",
  10: "Episode 12",
  11: "Episode 13",
  12: "Episode 14",
};

function getEpisodeLabel(episodeNum) {
  if (EPISODE_LABELS[episodeNum]) return EPISODE_LABELS[episodeNum];
  return `Episode ${episodeNum}`;
}

/**
 * episodes.json "episode" value (snapshot order) -> TV episode(s)
 * ✅ EXTENDED: add entry 11 -> TV 13 and entry 12 -> TV 14
 */
const TV_EPISODES_BY_ENTRY = {
  1: [1, 2, 3, 4, 5, 6, 7],
  3: [8],
  7: [9],
  8: [10],
  9: [11],
  10: [12],
  11: [13],
  12: [14],
};

function getTvEpisodesForEntry(entryEpisodeNum) {
  return TV_EPISODES_BY_ENTRY[entryEpisodeNum] ?? [entryEpisodeNum];
}

/* =========================
   Delimited parsing (TSV/CSV/;), skip blank first row
========================= */
const norm = (s) =>
  String(s ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();

function decodeTextSmart(filePath) {
  // keep it simple: read utf8 + strip BOM
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function pickDelimiterFromHeaderLine(line) {
  // prefer tab if present
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function parseSimpleDelimited(text, delim) {
  return text.split(/\r?\n/).map((l) => l.split(delim));
}

function rowIsEffectivelyEmpty(row) {
  return (row || []).every((c) => norm(c) === "");
}

/* =========================
   TEAM SCORE (SUM RedWon/BlueWon)
   EpisodeID -> { Athinaioi, Eparxiotes }
========================= */
function buildTeamScoresFromDuels_SUM(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️ duels.csv not found at: ${filePath}`);
    return new Map();
  }

  const text = decodeTextSmart(filePath);
  const lines = text.split(/\r?\n/);

  const headerLine =
    lines.find((l) => /DuelID|ChallengeID|EpisodeID/i.test(l)) ??
    lines.find((l) => /episodeid/i.test(l)) ??
    (lines[0] ?? "");

  const delim = pickDelimiterFromHeaderLine(headerLine);

  let rows = parseSimpleDelimited(text, delim);

  while (rows.length && rowIsEffectivelyEmpty(rows[0])) rows.shift();
  if (rows.length < 2) return new Map();

  const header = rows[0].map(norm);
  const idx = (name) => header.findIndex((h) => h === norm(name));

  const epIdx = idx("episodeid");
  const redWonIdx = idx("redwon");
  const blueWonIdx = idx("bluewon");

  if (epIdx === -1 || redWonIdx === -1 || blueWonIdx === -1) {
    console.log("⚠️ Missing required columns for score SUM(RedWon/BlueWon).");
    console.log("   Delimiter detected:", JSON.stringify(delim));
    console.log("   Header columns:", header.slice(0, 40));
    return new Map();
  }

  const scores = new Map(); // EpisodeID -> { Athinaioi, Eparxiotes }

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (!line || rowIsEffectivelyEmpty(line)) continue;

    const rawEpisode = String(line[epIdx] ?? "").trim();
    const episodeId = (rawEpisode.match(/\d+/)?.[0] ?? "").trim();
    if (!episodeId) continue;

    const red = Number(String(line[redWonIdx] ?? "0").trim() || "0");
    const blue = Number(String(line[blueWonIdx] ?? "0").trim() || "0");

    if (!scores.has(episodeId)) scores.set(episodeId, { Athinaioi: 0, Eparxiotes: 0 });

    const agg = scores.get(episodeId);
    agg.Athinaioi += Number.isFinite(red) ? red : 0;
    agg.Eparxiotes += Number.isFinite(blue) ? blue : 0;
  }

  return scores;
}

function computeTeamResultForEntry(teamScoresByTvEpisode, entryEpisodeNum) {
  const tvEps = getTvEpisodesForEntry(entryEpisodeNum);

  let ath = 0;
  let epa = 0;
  let foundAny = false;

  for (const tv of tvEps) {
    const sc = teamScoresByTvEpisode.get(String(tv));
    if (!sc) continue;
    foundAny = true;
    ath += Number(sc.Athinaioi ?? 0);
    epa += Number(sc.Eparxiotes ?? 0);
  }

  if (!foundAny) return null;

  let winner = "Draw";
  if (ath > epa) winner = "Athinaioi";
  else if (epa > ath) winner = "Eparxiotes";

  return {
    score: { Athinaioi: ath, Eparxiotes: epa },
    winner,
    method: "sum_redwon_bluewon",
  };
}

/* =========================
   MAIN
========================= */
if (!fs.existsSync(archiveDir)) {
  console.error(`Missing archive folder: ${archiveDir}`);
  process.exit(1);
}

const teamScoresByTvEpisode = buildTeamScoresFromDuels_SUM(duelsPath);
console.log(
  "ℹ️ Duel-score EpisodeIDs found:",
  Array.from(teamScoresByTvEpisode.keys()).slice(0, 30).join(", ")
);

const files = fs
  .readdirSync(archiveDir)
  .filter((f) =>
    /^rankings_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.json$/.test(f)
  )
  .map((f) => ({ f, date: parseStampFromFilename(f) }))
  .filter((x) => x.date != null)
  .sort((a, b) => a.date.getTime() - b.date.getTime()); // oldest -> newest

if (files.length < 2) {
  console.log("ℹ️ Not enough snapshots to build episodes (need at least 2).");
  fs.writeFileSync(outPath, JSON.stringify([], null, 2), "utf8");
  process.exit(0);
}

const episodes = [];

for (let i = 1; i < files.length; i++) {
  const prev = files[i - 1];
  const curr = files[i];

  const episodeNum = i;
  if (SKIP_EPISODES.has(episodeNum)) continue;

  const prevRows = safeReadJSON(path.join(archiveDir, prev.f)) || [];
  const currRows = safeReadJSON(path.join(archiveDir, curr.f)) || [];

  const diffs = computeDiff(prevRows, currRows);

  const up = topMovers(diffs, "up", 10);
  const down = topMovers(diffs, "down", 10);

  const teamSwing = computeTeamSwing(diffs);

  const athDiffs = byTeam(diffs, "Athinaioi");
  const epaDiffs = byTeam(diffs, "Eparxiotes");

  const athUp = topMovers(athDiffs, "up", 5);
  const athDown = topMovers(athDiffs, "down", 5);
  const epaUp = topMovers(epaDiffs, "up", 5);
  const epaDown = topMovers(epaDiffs, "down", 5);

  const biggestRiseByTeam = {
    Athinaioi: athUp[0] || null,
    Eparxiotes: epaUp[0] || null,
  };

  const biggestFallByTeam = {
    Athinaioi: athDown[0] || null,
    Eparxiotes: epaDown[0] || null,
  };

  const teamResult = computeTeamResultForEntry(teamScoresByTvEpisode, episodeNum);

  episodes.push({
    id: makeIdFromFile(curr.f),
    episode: episodeNum,
    label: getEpisodeLabel(episodeNum),
    dateISO: curr.date.toISOString(),
    prevSnapshot: prev.f,
    currSnapshot: curr.f,
    summary: {
      comparedPlayers: diffs.length,
      biggestRise: up[0] || null,
      biggestFall: down[0] || null,
      teamSwing,
      biggestRiseByTeam,
      biggestFallByTeam,
      teamResult,
    },
    movers: {
      up,
      down,
      byTeam: {
        Athinaioi: { up: athUp, down: athDown },
        Eparxiotes: { up: epaUp, down: epaDown },
      },
    },
  });
}

episodes.reverse();

fs.writeFileSync(outPath, JSON.stringify(episodes, null, 2), "utf8");
console.log(`✅ Built ${episodes.length} episodes → ${outPath}`);
console.log(
  `ℹ️ Skipped dev/test episodes: ${Array.from(SKIP_EPISODES)
    .sort((a, b) => a - b)
    .join(", ")}`
);
console.log(`ℹ️ Team scores loaded from duels.csv: ${fs.existsSync(duelsPath) ? "YES" : "NO"}`);
