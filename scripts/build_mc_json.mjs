// Destination: scripts/build_mc_json.mjs
// File: build_mc_json.mjs

import fs from "fs";
import path from "path";

const root = process.cwd();
const MC_ROOT = path.join(root, "src", "data", "mc");

const LATEST_DIR = path.join(MC_ROOT, "latest");
const ARCHIVE_DIR = path.join(MC_ROOT, "archive");

// -----------------------------
// utilities
// -----------------------------
function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJsonPretty(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function nowISO() {
  return new Date().toISOString();
}
function normalizeKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " pct ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(csvText) {
  const text = csvText.replace(/^\uFEFF/, ""); // strip BOM
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row.map((x) => String(x ?? "").replace(/\r$/, "")));
      row = [];
      continue;
    }

    field += c;
  }

  row.push(field);
  rows.push(row.map((x) => String(x ?? "").replace(/\r$/, "")));
  return rows;
}

function isBlankRow(arr) {
  return arr.every((v) => String(v ?? "").trim() === "");
}

function parseValue(raw) {
  const s0 = String(raw ?? "").trim();

  if (s0 === "" || s0 === "-" || s0.toLowerCase() === "na" || s0.toLowerCase() === "n/a") {
    return null;
  }

  const hasPct = /%$/.test(s0);
  const cleaned = s0.replace(/\$/g, "").replace(/,/g, "").trim();

  if (/^[+-]?\d+(\.\d+)?%?$/.test(cleaned)) {
    const num = Number(cleaned.replace(/%$/, ""));
    if (!Number.isFinite(num)) return s0;
    return hasPct ? num / 100 : num;
  }

  if (cleaned.toLowerCase() === "true") return true;
  if (cleaned.toLowerCase() === "false") return false;

  return s0;
}

function rowsToObjects(rows) {
  const nonBlank = rows.filter((r) => !isBlankRow(r));
  if (nonBlank.length === 0) return { headers: [], objects: [] };

  const headers = nonBlank[0].map((h) => String(h ?? "").trim());
  const objects = [];

  for (let i = 1; i < nonBlank.length; i++) {
    const r = nonBlank[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] || `col_${j + 1}`;
      obj[key] = parseValue(r[j] ?? "");
    }
    objects.push(obj);
  }
  return { headers, objects };
}

// -----------------------------
// metric-value converters
// -----------------------------

// Classic 2-column Metric/Value
function metricValueTwoColToJson(rows) {
  const nonBlank = rows.filter((r) => !isBlankRow(r));
  const header = nonBlank[0].map((h) => String(h ?? "").trim());
  const norm = header.map(normalizeKey);

  const mIdx = norm.indexOf("metric");
  const vIdx = norm.indexOf("value");

  const idxMetric = mIdx >= 0 ? mIdx : 0;
  const idxValue = vIdx >= 0 ? vIdx : 1;

  const metrics = {};
  const labels = {};

  for (let i = 1; i < nonBlank.length; i++) {
    const r = nonBlank[i];
    const label = String(r[idxMetric] ?? "").trim();
    if (!label) continue;
    const k = normalizeKey(label);
    metrics[k] = parseValue(r[idxValue] ?? "");
    labels[k] = label;
  }

  return { metrics, labels };
}

// Wide format: Row1 = metric names, Row2 = values
function metricValueWideToJson(rows) {
  const nonBlank = rows.filter((r) => !isBlankRow(r));
  const header = nonBlank[0].map((h) => String(h ?? "").trim());
  const values = nonBlank[1] ?? [];

  const metrics = {};
  const labels = {};

  for (let j = 0; j < header.length; j++) {
    const label = String(header[j] ?? "").trim();
    if (!label) continue;
    const k = normalizeKey(label);
    metrics[k] = parseValue(values[j] ?? "");
    labels[k] = label;
  }

  return { metrics, labels };
}

function isTwoColMetricValue(rows) {
  const nonBlank = rows.filter((r) => !isBlankRow(r));
  if (nonBlank.length < 2) return false;
  if (nonBlank[0].length !== 2) return false;

  const norm = nonBlank[0].map((h) => normalizeKey(h));
  return norm.includes("metric") && norm.includes("value");
}

function isWideMetricValue(rows) {
  const nonBlank = rows.filter((r) => !isBlankRow(r));
  if (nonBlank.length < 2) return false;

  // Wide: many columns, only one value row (your new format)
  // We treat as wide if:
  // - first row has >= 3 columns
  // - second row exists
  // - and there are no additional nonblank rows beyond row2 (or they’re empty)
  if (nonBlank[0].length < 3) return false;
  const extraRows = nonBlank.slice(2);
  const hasExtraData = extraRows.some((r) => !isBlankRow(r));
  return !hasExtraData;
}

function detectIdColumn(headers) {
  const norm = headers.map(normalizeKey);
  const candidates = ["ticker", "symbol", "stock", "stock_name", "asset", "name", "security"];
  for (const c of candidates) {
    const idx = norm.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// -----------------------------
// core build
// -----------------------------
function buildFolder(folderPath, runId = "latest") {
  if (!isDir(folderPath)) return;

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const csvFiles = entries
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".csv"))
    .map((d) => d.name);

  if (!csvFiles.length) return;

  console.log(`\n[mc:build] Processing folder: ${path.relative(root, folderPath)} (${runId})`);

  for (const csvName of csvFiles) {
    const csvPath = path.join(folderPath, csvName);
    const base = csvName.replace(/\.csv$/i, "");
    const jsonPath = path.join(folderPath, `${base}.json`);

    const rows = parseCsv(readText(csvPath));

    let payload;

    if (isTwoColMetricValue(rows)) {
      const mv = metricValueTwoColToJson(rows);
      payload = {
        kind: "metric_value",
        schema_version: 1,
        run_id: runId,
        generated_at: nowISO(),
        source_csv: csvName,
        ...mv,
      };
    } else if (isWideMetricValue(rows)) {
      const mv = metricValueWideToJson(rows);
      payload = {
        kind: "metric_value",
        schema_version: 1,
        run_id: runId,
        generated_at: nowISO(),
        source_csv: csvName,
        ...mv,
      };
    } else {
      const { headers, objects } = rowsToObjects(rows);
      const idCol = detectIdColumn(headers);
      const byId = {};

      if (idCol) {
        for (const o of objects) {
          const key = o[idCol];
          if (typeof key === "string" && key.trim()) byId[key.trim()] = o;
          else if (typeof key === "number") byId[String(key)] = o;
        }
      }

      payload = {
        kind: "table",
        schema_version: 1,
        run_id: runId,
        generated_at: nowISO(),
        source_csv: csvName,
        headers,
        rows: objects,
        ...(idCol ? { id_column: idCol, by_id: byId } : {}),
      };
    }

    writeJsonPretty(jsonPath, payload);
    console.log(`  ✓ ${csvName} -> ${path.basename(jsonPath)}`);
  }
}

function getArchiveRunDirs() {
  if (!isDir(ARCHIVE_DIR)) return [];
  return fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function main() {
  if (!exists(MC_ROOT)) {
    console.log(`[mc:build] No folder found: ${path.relative(root, MC_ROOT)}`);
    process.exit(0);
  }

  buildFolder(LATEST_DIR, "latest");

  for (const runFolderName of getArchiveRunDirs()) {
    buildFolder(path.join(ARCHIVE_DIR, runFolderName), runFolderName);
  }

  console.log("\n[mc:build] Done.");
}

main();
