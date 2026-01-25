import fs from "fs";
import path from "path";

const root = process.cwd();
const archiveDir = path.join(root, "src", "data", "archive");
const outPath = path.join(root, "src", "data", "episodes.json");

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
  // rankings_2026-01-22_07-43-54-088.json
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
  // rankings_2026-01-22_07-43-54-088.json -> 2026-01-22_07-43-54-088
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
    (d) => String(d.team).trim().toLowerCase() === String(team).trim().toLowerCase()
  );
}

/**
 * ✅ Output matches homepage expectation:
 * teamSwing: {
 *   teams: {
 *     Athinaioi: { sum, avg, n },
 *     Eparxiotes: { sum, avg, n }
 *   },
 *   winner,
 *   margin
 * }
 */
function computeTeamSwing(diffs) {
  const sum = (arr) =>
    arr.reduce((acc, d) => acc + (d.delta != null && Number.isFinite(d.delta) ? d.delta : 0), 0);

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

// ---------- MAIN ----------

if (!fs.existsSync(archiveDir)) {
  console.error(`Missing archive folder: ${archiveDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(archiveDir)
  .filter((f) => /^rankings_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.json$/.test(f))
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

  const athUp = topMovers(byTeam(diffs, "Athinaioi"), "up", 5);
  const athDown = topMovers(byTeam(diffs, "Athinaioi"), "down", 5);
  const epaUp = topMovers(byTeam(diffs, "Eparxiotes"), "up", 5);
  const epaDown = topMovers(byTeam(diffs, "Eparxiotes"), "down", 5);

  const currDate = curr.date;
  const episodeNum = i; // ✅ safe (based on snapshot order)
  const label = `Episode ${episodeNum} — ${currDate.toISOString().slice(0, 10)}`;

  episodes.push({
    id: makeIdFromFile(curr.f),
    episode: episodeNum, // ✅ numeric episode for UI later
    label,
    dateISO: currDate.toISOString(),
    prevSnapshot: prev.f,
    currSnapshot: curr.f,
    summary: {
      comparedPlayers: diffs.length,
      biggestRise: up[0] || null,
      biggestFall: down[0] || null,
      teamSwing, // ✅ has .teams.Athinaioi.avg etc.
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

// newest first
episodes.reverse();

fs.writeFileSync(outPath, JSON.stringify(episodes, null, 2), "utf8");
console.log(`✅ Built ${episodes.length} episodes → ${outPath}`);
console.log(`ℹ️ Episode labels are now "Episode X — YYYY-MM-DD"`);
console.log(`ℹ️ teamSwing shape matches homepage: summary.teamSwing.teams.Athinaioi.avg`);
