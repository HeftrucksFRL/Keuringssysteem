import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const cwd = process.cwd();
  return {
    oldFile:
      argv[argv.indexOf("--old") + 1] ||
      path.join(cwd, "Forminator nummers oude site 2021-2025.csv"),
    newFile:
      argv[argv.indexOf("--new") + 1] ||
      path.join(cwd, "Forminator nummers 2025-2026.csv"),
    sourceDir:
      argv[argv.indexOf("--source-dir") + 1] ||
      path.join(cwd, "Herimport keuringsapp"),
    mergedOut:
      argv[argv.indexOf("--merged-out") + 1] ||
      path.join(cwd, "Forminator nummers gecombineerd.csv"),
    matchedOut:
      argv[argv.indexOf("--matched-out") + 1] ||
      path.join(cwd, "Herimport keuringsapp", "Import-nummer-matches.csv"),
    manualOut:
      argv[argv.indexOf("--manual-out") + 1] ||
      path.join(cwd, "Herimport keuringsapp", "Import-nummer-handmatig.csv"),
    unmatchedOut:
      argv[argv.indexOf("--unmatched-out") + 1] ||
      path.join(cwd, "Herimport keuringsapp", "Import-nummer-ongekoppeld.csv"),
    summaryOut:
      argv[argv.indexOf("--summary-out") + 1] ||
      path.join(cwd, "Herimport keuringsapp", "Import-nummer-overzicht.md")
  };
}

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .trim();
}

function normalizeWhitespace(value) {
  return clean(value).replace(/\s+/g, " ");
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

function parseCsv(content, delimiter = ",") {
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

function toCsv(rows, headers, delimiter = ";") {
  const escape = (value) => {
    const text = String(value ?? "");
    if (
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r") ||
      text.includes(delimiter)
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(delimiter)];

  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(delimiter));
  }

  return `\uFEFF${lines.join("\n")}\n`;
}

function inferSourceLabel(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("oude site")) return "oude_site";
  if (name.includes("2025-2026")) return "huidige_site";
  return "onbekend";
}

function normalizeExportTimestamp(value) {
  const raw = clean(value);
  return raw.replace("T", " ").slice(0, 19);
}

function normalizeMinute(value) {
  const raw = clean(value).replace("T", " ");
  return raw.length >= 16 ? raw.slice(0, 16) : raw;
}

function parseDetailTimestamp(value) {
  const raw = clean(value);
  if (!raw) return "";

  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (direct) {
    return `${direct[1]}-${direct[2]}-${direct[3]} ${direct[4]}:${direct[5]}`;
  }

  const monthMap = {
    jan: "01",
    januari: "01",
    feb: "02",
    februari: "02",
    mar: "03",
    mrt: "03",
    maart: "03",
    apr: "04",
    april: "04",
    may: "05",
    mei: "05",
    jun: "06",
    juni: "06",
    jul: "07",
    juli: "07",
    aug: "08",
    augustus: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    okt: "10",
    oktober: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12"
  };

  const match = raw.match(
    /^([A-Za-zÀ-ÿ]+)\s+(\d{1,2}),\s+(\d{4})\s+@\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
  );

  if (!match) return "";

  const [, monthRaw, dayRaw, yearRaw, hourRaw, minuteRaw, meridiemRaw] = match;
  const month = monthMap[monthRaw.toLowerCase()];
  if (!month) return "";

  let hour = Number.parseInt(hourRaw, 10);
  const minute = minuteRaw.padStart(2, "0");
  const meridiem = clean(meridiemRaw).toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return `${yearRaw}-${month}-${dayRaw.padStart(2, "0")} ${String(hour).padStart(2, "0")}:${minute}`;
}

function inferInspectionType(fileName) {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("heftruck-reachtruck")) return "heftruck_reachtruck";
  if (normalized.includes("palletwagen-heffer-en-stapelaar")) {
    return "palletwagen_heffer_stapelaar";
  }
  if (normalized.includes("hoogwerker")) return "hoogwerker";
  if (normalized.includes("verreiker")) return "verreiker";
  if (normalized.includes("graafmachine")) return "graafmachine";
  if (normalized.includes("shovel")) return "shovel";
  if (normalized.includes("stellingmateriaal")) return "stellingmateriaal";
  if (normalized.includes("batterij")) return "batterij_lader";
  return "onbekend";
}

function firstNonEmpty(row, keys) {
  for (const key of keys) {
    if (clean(row[key])) return clean(row[key]);
  }
  return "";
}

function extractCustomer(value) {
  const lines = clean(value)
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  return lines[0] ?? "";
}

async function readNumberExport(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const source = inferSourceLabel(filePath);
  const rows = parseCsv(raw, ";").map((row) => ({
    source_file: path.basename(filePath),
    source_site: source,
    oud_nummer: clean(row.oud_nummer),
    form_id: clean(row.form_id),
    entry_type: clean(row.entry_type),
    inzendingstijd: normalizeExportTimestamp(row.inzendingstijd),
    inzendingstijd_minuut: normalizeMinute(row.inzendingstijd)
  }));
  return rows.filter((row) => row.oud_nummer && row.inzendingstijd_minuut);
}

async function readDetailRows(sourceDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".csv") &&
        entry.name.toLowerCase().startsWith("forminator-keuring-")
    )
    .map((entry) => entry.name)
    .sort();

  const detailRows = [];

  for (const fileName of files) {
    const fullPath = path.join(sourceDir, fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    const rows = parseCsv(raw);
    const inspectionType = inferInspectionType(fileName);

    rows.forEach((row, index) => {
      const sourceSubmissionTime = clean(row["Inzendingstijd"]);
      const normalizedMinute = parseDetailTimestamp(sourceSubmissionTime);
      if (!normalizedMinute) return;

      detailRows.push({
        file_name: fileName,
        row_number: String(index + 2),
        inspection_type: inspectionType,
        source_submission_time: sourceSubmissionTime,
        source_submission_minute: normalizedMinute,
        inspection_date: clean(row["Keuringsdatum"]),
        customer_name: extractCustomer(row["Bedrijfsgegevens gebruiker"] || row["Textarea"]),
        brand: firstNonEmpty(row, ["Merk", "Merk voertuig", "Fabricaat", "Fabricaat__2"]),
        model: firstNonEmpty(row, ["Type", "Type voertuig", "Ladertype", "Batterijtype"]),
        serial_number: firstNonEmpty(
          row,
          ["Serienummer", "Serienummer voertuig", "Serienummer__2", "Intern nummer batterij", "Intern nummer lader"]
        )
      });
    });
  }

  return detailRows;
}

async function readManualOverrides(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const rows = parseCsv(raw, ";");
    return new Map(
      rows
        .map((row) => ({
          key: `${clean(row.file_name)}|${clean(row.row_number)}`,
          oudNummer: clean(row.oud_nummer)
        }))
        .filter((row) => row.key !== "|" && row.oudNummer)
        .map((row) => [row.key, row.oudNummer])
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

function buildSummary({
  oldRows,
  newRows,
  mergedRows,
  duplicateMinutes,
  detailRows,
  matchedRows,
  resolvedByFormId,
  resolvedByManual,
  resolvedByDummy,
  unmatchedRows,
  ambiguousRows,
  unmatchedByYear
}) {
  return [
    "# Import-nummer-overzicht",
    "",
    "## Nummerexports",
    "",
    `- Oude site: ${oldRows.length} regels`,
    `- Huidige site: ${newRows.length} regels`,
    `- Gecombineerd: ${mergedRows.length} regels`,
    `- Dubbele oud_nummers tussen sites: ${
      new Set(
        mergedRows
          .map((row) => row.oud_nummer)
          .filter((value, index, array) => array.indexOf(value) !== index)
      ).size
    }`,
    `- Dubbele minuten in gecombineerde export: ${duplicateMinutes.length}`,
    "",
    "## Detail-CSV's",
    "",
    `- Bronregels met Inzendingstijd: ${detailRows.length}`,
    `- Direct gekoppeld op minuut: ${matchedRows.length}`,
    `- Extra opgelost via form_id/type: ${resolvedByFormId}`,
    `- Handmatig opgelost: ${resolvedByManual}`,
    `- Dummy-nummers toegekend: ${resolvedByDummy}`,
    `- Ambigue matches: ${ambiguousRows.length}`,
    `- Niet gekoppeld: ${unmatchedRows.length}`,
    "",
    "## Conclusie",
    "",
    duplicateMinutes.length === 0
      ? "- De twee nummerexports kunnen veilig samengevoegd worden op bron + tijd."
      : "- Er zijn dubbele minuten in de exportbron, maar de resterende cases zijn nu afgevangen.",
    ambiguousRows.length === 0
      ? "- De detail-CSV's zijn technisch koppelbaar aan oude nummers op inzendingstijd-minuut."
      : "- Er zijn detailregels met meerdere kandidaatmappings.",
    unmatchedRows.length === 0
      ? "- Alle detailregels hebben een oude nummermatch."
      : `- Er blijven ${unmatchedRows.length} detailregels over zonder nummermatch; die moeten we nalopen.`,
    unmatchedByYear.length
      ? `- Niet gekoppeld per jaar: ${unmatchedByYear
          .map(({ year, count }) => `${year}: ${count}`)
          .join(", ")}.`
      : "- Er zijn geen resterende ongekoppelde jaren.",
    "",
    "## Bestanden",
    "",
    "- `Forminator nummers gecombineerd.csv`",
    "- `Herimport keuringsapp/Import-nummer-matches.csv`",
    "- `Herimport keuringsapp/Import-nummer-ongekoppeld.csv`"
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const oldRows = await readNumberExport(args.oldFile);
  const newRows = await readNumberExport(args.newFile);
  const mergedRows = [...oldRows, ...newRows].sort((left, right) =>
    left.inzendingstijd.localeCompare(right.inzendingstijd)
  );

  const exportsByMinute = new Map();
  for (const row of mergedRows) {
    const bucket = exportsByMinute.get(row.inzendingstijd_minuut) ?? [];
    bucket.push(row);
    exportsByMinute.set(row.inzendingstijd_minuut, bucket);
  }

  const duplicateMinutes = [...exportsByMinute.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([minute, rows]) => ({ minute, rows }));

  const detailRows = await readDetailRows(args.sourceDir);
  const manualOverrides = await readManualOverrides(args.manualOut);

  const matchedRows = [];
  const unmatchedRows = [];
  const ambiguousRows = [];

  for (const row of detailRows) {
    const candidates = exportsByMinute.get(row.source_submission_minute) ?? [];

    if (candidates.length === 1) {
      const match = candidates[0];
      matchedRows.push({
        ...row,
        source_site: match.source_site,
        oud_nummer: match.oud_nummer,
        form_id: match.form_id,
        export_inzendingstijd: match.inzendingstijd
      });
      continue;
    }

    if (candidates.length > 1) {
      ambiguousRows.push({
        ...row,
        candidate_count: String(candidates.length),
        candidate_numbers: candidates.map((candidate) => candidate.oud_nummer).join(", "),
        candidate_sites: candidates.map((candidate) => candidate.source_site).join(", ")
      });
      continue;
    }

    unmatchedRows.push(row);
  }

  const formIdTypeMap = new Map();
  for (const row of matchedRows) {
    const types = formIdTypeMap.get(row.form_id) ?? new Set();
    types.add(row.inspection_type);
    formIdTypeMap.set(row.form_id, types);
  }

  const resolvedAmbiguousRows = [];
  const resolvedManualRows = [];
  const stillAmbiguousRows = [];

  for (const row of ambiguousRows) {
    const overrideNumber = manualOverrides.get(`${row.file_name}|${row.row_number}`) ?? "";
    if (overrideNumber) {
      const overrideMatch = (exportsByMinute.get(row.source_submission_minute) ?? []).find(
        (candidate) => candidate.oud_nummer === overrideNumber
      );

      if (overrideMatch) {
        resolvedManualRows.push({
          ...row,
          source_site: overrideMatch.source_site,
          oud_nummer: overrideMatch.oud_nummer,
          form_id: overrideMatch.form_id,
          export_inzendingstijd: overrideMatch.inzendingstijd
        });
        continue;
      }
    }

    const candidates = (exportsByMinute.get(row.source_submission_minute) ?? []).filter(
      (candidate) => {
        const types = formIdTypeMap.get(candidate.form_id);
        return types && types.size === 1 && types.has(row.inspection_type);
      }
    );

    if (candidates.length === 1) {
      const match = candidates[0];
      resolvedAmbiguousRows.push({
        ...row,
        source_site: match.source_site,
        oud_nummer: match.oud_nummer,
        form_id: match.form_id,
        export_inzendingstijd: match.inzendingstijd
      });
      continue;
    }

    stillAmbiguousRows.push(row);
  }

  matchedRows.push(...resolvedAmbiguousRows);
  matchedRows.push(...resolvedManualRows);

  const dummyResolvedRows = [];
  const stillUnmatchedRows = [];
  let dummyCounter = 900;

  for (const row of unmatchedRows) {
    const year = row.source_submission_minute.slice(0, 4);
    if (year === "2020") {
      dummyResolvedRows.push({
        ...row,
        source_site: "dummy_2020",
        oud_nummer: String(dummyCounter),
        form_id: "dummy",
        export_inzendingstijd: ""
      });
      dummyCounter += 1;
    } else {
      stillUnmatchedRows.push(row);
    }
  }

  matchedRows.push(...dummyResolvedRows);

  const unmatchedByYear = [...stillUnmatchedRows]
    .map((row) => ({
      year: row.source_submission_minute.slice(0, 4) || "onbekend"
    }))
    .reduce((accumulator, current) => {
      accumulator.set(current.year, (accumulator.get(current.year) ?? 0) + 1);
      return accumulator;
    }, new Map());

  const unmatchedByYearRows = [...unmatchedByYear.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((left, right) => left.year.localeCompare(right.year));

  await fs.writeFile(
    args.mergedOut,
    toCsv(mergedRows, [
      "source_site",
      "source_file",
      "oud_nummer",
      "form_id",
      "entry_type",
      "inzendingstijd",
      "inzendingstijd_minuut"
    ])
  );

  await fs.writeFile(
    args.matchedOut,
    toCsv(matchedRows, [
      "file_name",
      "row_number",
      "inspection_type",
      "source_submission_time",
      "source_submission_minute",
      "source_site",
      "oud_nummer",
      "form_id",
      "export_inzendingstijd",
      "inspection_date",
      "customer_name",
      "brand",
      "model",
      "serial_number"
    ])
  );

  const unresolvedRows = [...ambiguousRows, ...unmatchedRows];
  const finalUnresolvedRows = [...stillAmbiguousRows, ...stillUnmatchedRows];

  await fs.writeFile(
    args.unmatchedOut,
    toCsv(finalUnresolvedRows, [
      "file_name",
      "row_number",
      "inspection_type",
      "source_submission_time",
      "source_submission_minute",
      "inspection_date",
      "customer_name",
      "brand",
      "model",
      "serial_number",
      "candidate_count",
      "candidate_numbers",
      "candidate_sites"
    ])
  );

  await fs.writeFile(
    args.summaryOut,
    buildSummary({
      oldRows,
      newRows,
      mergedRows,
      duplicateMinutes,
      detailRows,
      matchedRows,
      resolvedByFormId: resolvedAmbiguousRows.length,
      resolvedByManual: resolvedManualRows.length,
      resolvedByDummy: dummyResolvedRows.length,
      unmatchedRows: stillUnmatchedRows,
      ambiguousRows: stillAmbiguousRows,
      unmatchedByYear: unmatchedByYearRows
    })
  );

  console.log(
    JSON.stringify(
      {
        oldRows: oldRows.length,
        newRows: newRows.length,
        mergedRows: mergedRows.length,
        duplicateMinutes: duplicateMinutes.length,
        detailRows: detailRows.length,
        matchedRows: matchedRows.length,
        resolvedByFormId: resolvedAmbiguousRows.length,
        resolvedByManual: resolvedManualRows.length,
        resolvedByDummy: dummyResolvedRows.length,
        ambiguousRows: stillAmbiguousRows.length,
        unmatchedRows: stillUnmatchedRows.length,
        mergedOut: args.mergedOut,
        matchedOut: args.matchedOut,
        unmatchedOut: args.unmatchedOut,
        summaryOut: args.summaryOut
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
