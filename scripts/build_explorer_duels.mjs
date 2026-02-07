// scripts/build_explorer_duels.mjs
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

// Your real CSV location:
const DUELS_CSV = path.join(ROOT, "src", "data", "duels.csv");
const GENERAL_CSV = path.join(ROOT, "src", "data", "general_stats.csv");

// Generated output:
const OUT_DIR = path.join(ROOT, "src", "data", "explorer");
const OUT_DUELS = path.join(OUT_DIR, "duels.v1.json");
const OUT_META = path.join(OUT_DIR, "meta.v1.json");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, "utf-8");
}

// Minimal CSV parser that works with your structure.
// It also handles your "header is a data line" situation.
function parseCsv(text, headerHint = null) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // If a file has a normal header row, this still works.
  // For duels.csv, your true header line contains "DuelID,ChallengeID,EpisodeID,..."
  let headerIndex = 0;
  if (headerHint) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(headerHint)) {
        headerIndex = i;
        break;
      }
    }
  }

  const header = lines[headerIndex].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 3) continue;

    const obj = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      if (!key) continue;
      obj[key] = (parts[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return rows;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "nan") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBoolOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "") return null;
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return null;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return null;
}

function normalizeAirDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map((x) => Number(x));
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  // Fallback Date parse
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => String(a).localeCompare(String(b)));
}

function main() {
  if (!exists(DUELS_CSV)) {
    console.error(`Missing ${DUELS_CSV}`);
    process.exit(1);
  }

  const duelsRaw = parseCsv(readText(DUELS_CSV), "DuelID");

  const generalRows = exists(GENERAL_CSV) ? parseCsv(readText(GENERAL_CSV), "PlayerID") : [];

  // Build player lookup from general_stats.csv: PlayerID -> {name, tribe}
  const playerById = new Map();
  for (const r of generalRows) {
    const pid = toNumberOrNull(pick(r, ["PlayerID"]));
    const name = pick(r, ["PlayerName"]);
    const tribe = pick(r, ["Tribe"]);
    if (pid !== null && name) {
      if (!playerById.has(pid)) {
        playerById.set(pid, {
          name: String(name).trim(),
          tribe: tribe ? String(tribe).trim() : null,
        });
      }
    }
  }

  // Optional: challenge lookup (fallback only)
  const challengeById = new Map();
  for (const r of generalRows) {
    const cid = toNumberOrNull(pick(r, ["ChallengeID"]));
    const eid = toNumberOrNull(pick(r, ["EpisodeID"]));
    const key = cid ?? eid;
    if (!key) continue;

    // only store if it looks like challenge meta exists on that row
    const week = toNumberOrNull(pick(r, ["Week"]));
    const airDate = normalizeAirDate(pick(r, ["AirDate"]));
    const propType = pick(r, ["PropType"]);
    const targetType = pick(r, ["target", "TargetType"]);
    const puzzle = toBoolOrNull(pick(r, ["Puzzle"]));
    const gamePrice = pick(r, ["GamePrice", "GamePrize"]);

    if (
      week !== null ||
      airDate !== null ||
      (propType && String(propType).trim() !== "") ||
      (targetType && String(targetType).trim() !== "") ||
      puzzle !== null ||
      (gamePrice && String(gamePrice).trim() !== "")
    ) {
      challengeById.set(key, {
        Week: week,
        AirDate: airDate,
        PropType: propType ? String(propType).trim() : null,
        TargetType: targetType ? String(targetType).trim() : null,
        Puzzle: puzzle,
        GamePrice: gamePrice ? String(gamePrice).trim() : null,
      });
    }
  }

  const out = [];

  for (const r of duelsRaw) {
    const duelId = toNumberOrNull(pick(r, ["DuelID"]));
    const challengeId = toNumberOrNull(pick(r, ["ChallengeID"]));
    const episodeId = toNumberOrNull(pick(r, ["EpisodeID"]));

    const redId = toNumberOrNull(pick(r, ["PlayerID"]));
    const blueId = toNumberOrNull(pick(r, ["OpponentID"]));

    if (duelId === null || (challengeId === null && episodeId === null) || redId === null || blueId === null) continue;

    const key = challengeId ?? episodeId;
    const fallbackMeta = challengeById.get(key) ?? {};

    // Slicers: prefer duels.csv, fallback to general_stats if needed
    const propType = String(pick(r, ["PropType"]) ?? fallbackMeta.PropType ?? "UNKNOWN").trim() || "UNKNOWN";
    const targetType = String(pick(r, ["TargetType"]) ?? fallbackMeta.TargetType ?? "UNKNOWN").trim() || "UNKNOWN";
    const gamePrice = String(pick(r, ["GamePrice", "GamePrize"]) ?? fallbackMeta.GamePrice ?? "UNKNOWN").trim() || "UNKNOWN";
    const puzzle = (() => {
      const v = pick(r, ["Puzzle"]);
      const b = toBoolOrNull(v);
      if (b !== null) return b;
      if (fallbackMeta.Puzzle !== undefined) return fallbackMeta.Puzzle;
      return null;
    })();
    const airDate = normalizeAirDate(pick(r, ["AirDate"]) ?? fallbackMeta.AirDate);
    const week = toNumberOrNull(pick(r, ["Week"]) ?? fallbackMeta.Week);

    // Shared fields
    const isFinalPoint = (toNumberOrNull(pick(r, ["IsFinalPoint"])) ?? 0) ? 1 : 0;

    // Red-side outcomes (from your columns)
    const wonRed = (toNumberOrNull(pick(r, ["Won", "RedWon"])) ?? 0) ? 1 : 0;
    const arrivedFirstRedRaw = toNumberOrNull(pick(r, ["ArrivedFirst"]));
    const arrivedFirstRed = (arrivedFirstRedRaw ?? 0) ? 1 : 0;

    // Blue-side outcomes: prefer BlueWon, else infer from Won
    const blueWonRaw = toNumberOrNull(pick(r, ["BlueWon"]));
    const wonBlue = blueWonRaw !== null ? (blueWonRaw ? 1 : 0) : (wonRed ? 0 : 1);

    // ArrivedFirst for blue: infer if it's binary
    const arrivedFirstBlue =
      arrivedFirstRedRaw !== null && (arrivedFirstRedRaw === 0 || arrivedFirstRedRaw === 1)
        ? (arrivedFirstRedRaw === 1 ? 0 : 1)
        : 0;

    // Margins by side
    const normMarginRed = toNumberOrNull(pick(r, ["NormMargin_Red"]));
    const normMarginBlue = toNumberOrNull(pick(r, ["NormMargin_Blue"]));

    // Names + tribe from general_stats
    const redInfo = playerById.get(redId);
    const blueInfo = playerById.get(blueId);

    const redName = redInfo?.name ?? `Player ${redId}`;
    const blueName = blueInfo?.name ?? `Player ${blueId}`;

    // Optional: Tribe from general_stats (useful for a future team slicer)
    const redTribe = redInfo?.tribe ?? null;
    const blueTribe = blueInfo?.tribe ?? null;

    // Emit RED row
    out.push({
      rowId: `c${key}_d${duelId}_p${redId}`,
      duelId,
      challengeId: challengeId ?? key,
      episodeId: episodeId ?? key,

      playerId: redId,
      playerName: redName,
      tribe: redTribe,

      // slicers
      propType,
      targetType,
      gamePrice,
      puzzle,
      airDate,
      week,

      // performance
      won: wonRed,
      arrivedFirst: arrivedFirstRed,
      isFinalPoint,

      // team + metric
      teamColor: "Red",
      normMargin: normMarginRed,
    });

    // Emit BLUE row
    out.push({
      rowId: `c${key}_d${duelId}_p${blueId}`,
      duelId,
      challengeId: challengeId ?? key,
      episodeId: episodeId ?? key,

      playerId: blueId,
      playerName: blueName,
      tribe: blueTribe,

      // slicers
      propType,
      targetType,
      gamePrice,
      puzzle,
      airDate,
      week,

      // performance
      won: wonBlue,
      arrivedFirst: arrivedFirstBlue,
      isFinalPoint,

      // team + metric
      teamColor: "Blue",
      normMargin: normMarginBlue,
    });
  }

  // meta for UI
  const meta = {
    version: 1,
    generatedAtISO: new Date().toISOString(),
    rowCount: out.length,
    values: {
      propType: uniqSorted(out.map((r) => r.propType).filter(Boolean)),
      targetType: uniqSorted(out.map((r) => r.targetType).filter(Boolean)),
      gamePrice: uniqSorted(out.map((r) => r.gamePrice).filter(Boolean)),
      week: Array.from(new Set(out.map((r) => r.week).filter((x) => x !== null && x !== undefined))).sort((a, b) => a - b),
      airDate: uniqSorted(out.map((r) => r.airDate).filter(Boolean)),
      puzzle: ["ALL", "ONLY", "EXCLUDE"],
    },
    ranges: {
      week: {
        min: out.reduce((m, r) => (r.week !== null && r.week < m ? r.week : m), Number.POSITIVE_INFINITY),
        max: out.reduce((m, r) => (r.week !== null && r.week > m ? r.week : m), Number.NEGATIVE_INFINITY),
      },
      airDate: {
        min: uniqSorted(out.map((r) => r.airDate).filter(Boolean))[0] ?? null,
        max: (() => {
          const a = uniqSorted(out.map((r) => r.airDate).filter(Boolean));
          return a.length ? a[a.length - 1] : null;
        })(),
      },
    },
  };

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_DUELS, JSON.stringify(out, null, 2), "utf-8");
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2), "utf-8");

  console.log(`Wrote ${OUT_DUELS} (${out.length} rows)`);
  console.log(`Wrote ${OUT_META}`);
}

main();
