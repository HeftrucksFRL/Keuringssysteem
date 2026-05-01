import fs from "node:fs/promises";
import path from "node:path";

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function uniquifyHeaders(headers) {
  const counts = new Map();
  return headers.map((header) => {
    const key = clean(header) || "kolom";
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next === 1 ? key : `${key}__${next}`;
  });
}

function parseCsv(content, delimiter = ";") {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = uniquifyHeaders(headerRow);

  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

export async function loadImportNumberMap(filePath) {
  if (!filePath) {
    return new Map();
  }

  const resolvedPath = path.resolve(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const rows = parseCsv(raw, ";");
  const result = new Map();

  for (const row of rows) {
    const fileName = clean(row.file_name);
    const rowNumber = clean(row.row_number);
    const oldNumber = clean(row.oud_nummer);

    if (!fileName || !rowNumber || !oldNumber) continue;
    result.set(`${fileName}|${rowNumber}`, oldNumber);
  }

  return result;
}

export function findLegacyNumber(numberMap, sourceFileName, rowNumber) {
  return numberMap.get(`${sourceFileName}|${rowNumber}`) ?? "";
}

export function buildLegacyInspectionNumber(inspectionDate, legacyNumber) {
  const dateValue = clean(inspectionDate);
  const numberValue = clean(legacyNumber);
  const year = dateValue.slice(0, 4);
  if (!/^\d{4}$/.test(year) || !/^\d+$/.test(numberValue)) {
    return null;
  }
  return Number(`${year}${numberValue.padStart(4, "0")}`);
}
