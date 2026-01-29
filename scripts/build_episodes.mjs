import fs from "fs";
import path from "path";

const root = process.cwd();
const archiveDir = path.join(root, "src", "data", "archive");
const outPath = path.join(root, "src", "data", "episodes.json");

// ✅ duels source (CSV)
const duelsPath = path.join(root, "src", "data", "duels.csv");

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

  const athAvg = athN > 0 ? Number((athSum / athN).toFixed(2)) : 0;
  const epaAvg = epaN > 0 ? Number((epaSum / epaN).toFixed(2)) : 0;

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

// ---------- EPISODE LABELING / SKIP RULES ----------

const SKIP_EPISODES = new Set([2, 4, 5, 6]);

const EPISODE_LABELS = {
  1: "Opening Phase (Ep 1–7)",
  3: "Episode 8",
  7: "Episode 9",
  8: "Episode 10",
  9: "Episode 11",
  10: "Episode 12", // future entry (safe to keep)
};

function getEpisodeLabel(episodeNum) {
  if (EPISODE_LABELS[episodeNum]) return EPISODE_LABELS[episodeNum];
  return `Episode ${episodeNum}`;
}

/**
 * ✅ This is the IMPORTANT mapping:
 * episodes.json "episode" value (snapshot order) -> TV episode(s)
 */
const TV_EPISODES_BY_ENTRY = {
  1: [1, 2, 3, 4, 5, 6, 7], // opening phase bundle
  3: [8],
  7: [9],
  8: [10],
  9: [11],
  10: [12], // future
};

function getTvEpisodesForEntry(entryEpisodeNum) {
  return TV_EPISODES_BY_ENTRY[entryEpisodeNum] ?? [entryEpisodeNum];
}

// ---------- CSV PARSING + TEAM SCORE ----------

function parseCSV(text) {
  // Handles commas + quotes ("a,b"), CRLF, etc.
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch === "\r") {
        // ignore
      } else {
        cur += ch;
      }
    }
  }

  // last cell
  row.push(cur);
  rows.push(row);

  // drop trailing empty line
  if (rows.length && rows[rows.length - 1].every((c) => String(c ?? "").trim() === "")) {
    rows.pop();
  }

  return rows;
}

function buildTeamScoresFromDuelsCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.log(`ℹ️ duels.csv not found at: ${csvPath}`);
    return new Map(); // EpisodeID -> { Athinaioi, Eparxiotes }
  }

  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCSV(text);
  if (rows.length < 2) return new Map();

  const header = rows[0].map((h) => String(h ?? "").trim());
  const idx = (name) => header.findIndex((h) => h === name);

  const epIdx = idx("EpisodeID");
  const tmIdx = idx("TeamMatchID");
  const redIdx = idx("RedTeamWin");
  const blueIdx = idx("BlueTeamWin");

  if (epIdx === -1 || tmIdx === -1 || redIdx === -1 || blueIdx === -1) {
    console.log("⚠️ duels.csv is missing one of: EpisodeID, TeamMatchID, RedTeamWin, BlueTeamWin");
    return new Map();
  }

  // EpisodeID -> TeamMatchID -> winner ("Athinaioi"|"Eparxiotes"|null)
  const perEpisode = new Map();

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const episodeId = String(line[epIdx] ?? "").trim();
    const teamMatchId = String(line[tmIdx] ?? "").trim();
    if (!episodeId || !teamMatchId) continue;

    const redWin = Number(line[redIdx] ?? 0);
    const blueWin = Number(line[blueIdx] ?? 0);

    let winner = null;
    if (redWin === 1 && blueWin !== 1) winner = "Athinaioi"; // Red = Athinaioi
    else if (blueWin === 1 && redWin !== 1) winner = "Eparxiotes"; // Blue = Eparxiotes

    if (!perEpisode.has(episodeId)) perEpisode.set(episodeId, new Map());
    const tmMap = perEpisode.get(episodeId);

    // TeamMatchID is unique per challenge; set once (or overwrite same value)
    tmMap.set(teamMatchId, winner);
  }

  // Convert to EpisodeID -> score
  const scores = new Map();
  for (const [episodeId, tmMap] of perEpisode.entries()) {
    let ath = 0;
    let epa = 0;

    for (const w of tmMap.values()) {
      if (w === "Athinaioi") ath++;
      else if (w === "Eparxiotes") epa++;
    }

    scores.set(episodeId, { Athinaioi: ath, Eparxiotes: epa });
  }

  return scores;
}

function computeTeamResultForEntry(teamScoresByTvEpisode, entryEpisodeNum) {
  const tvEps = getTvEpisodesForEntry(entryEpisodeNum);

  let ath = 0;
  let epa = 0;

  for (const tv of tvEps) {
    const key = String(tv);
    const sc = teamScoresByTvEpisode.get(key);
    if (!sc) continue;
    ath += Number(sc.Athinaioi ?? 0);
    epa += Number(sc.Eparxiotes ?? 0);
  }

  // If we have no data at all for this entry, return null
  if (ath === 0 && epa === 0) {
    // could still be a real 0-0, but in Survivor it’s unlikely.
    // This is mostly: “duels not available yet”.
    return null;
  }

  let winner = "Draw";
  if (ath > epa) winner = "Athinaioi";
  else if (epa > ath) winner = "Eparxiotes";

  return {
    score: { Athinaioi: ath, Eparxiotes: epa },
    winner,
  };
}

// ---------- MAIN ----------

if (!fs.existsSync(archiveDir)) {
  console.error(`Missing archive folder: ${archiveDir}`);
  process.exit(1);
}

const teamScoresByTvEpisode = buildTeamScoresFromDuelsCSV(duelsPath);

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

  const prevPath = path.join(archiveDir, prev.f);
  const currPath = path.join(archiveDir, curr.f);

  const prevRows = safeReadJSON(prevPath) || [];
  const currRows = safeReadJSON(currPath) || [];

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

  const currDate = curr.date;
  const episodeNum = i;

  if (SKIP_EPISODES.has(episodeNum)) continue;

  const label = getEpisodeLabel(episodeNum);

  const biggestRiseByTeam = {
    Athinaioi: athUp[0] || null,
    Eparxiotes: epaUp[0] || null,
  };

  const biggestFallByTeam = {
    Athinaioi: athDown[0] || null,
    Eparxiotes: epaDown[0] || null,
  };

  // ✅ REAL episode score from duels.csv (using your mapping)
  const teamResult = computeTeamResultForEntry(teamScoresByTvEpisode, episodeNum);

  episodes.push({
    id: makeIdFromFile(curr.f),
    episode: episodeNum,
    label,
    dateISO: currDate.toISOString(),
    prevSnapshot: prev.f,
    currSnapshot: curr.f,
    summary: {
      comparedPlayers: diffs.length,
      biggestRise: up[0] || null,
      biggestFall: down[0] || null,
      teamSwing, // analytics metric
      biggestRiseByTeam,
      biggestFallByTeam,
      teamResult, // ✅ real score + winner (or null if duels not available yet)
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
console.log(`ℹ️ Labels are clean display text`);
console.log(
  `ℹ️ Skipped dev/test episodes: ${Array.from(SKIP_EPISODES)
    .sort((a, b) => a - b)
    .join(", ")}`
);
console.log(
  `ℹ️ Team scores loaded from duels.csv: ${fs.existsSync(duelsPath) ? "YES" : "NO"}`
);
