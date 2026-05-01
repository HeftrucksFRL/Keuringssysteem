import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ROOT = "C:\\Users\\Admin\\Downloads";

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    summary: path.join(process.cwd(), "Broncontrole-2026-overzicht.md"),
    files: path.join(process.cwd(), "Broncontrole-2026-bestanden.csv"),
    missing: path.join(process.cwd(), "Broncontrole-2026-ontbrekend.csv")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--root") {
      args.root = argv[index + 1] ?? args.root;
      index += 1;
    } else if (current === "--summary") {
      args.summary = argv[index + 1] ?? args.summary;
      index += 1;
    } else if (current === "--files") {
      args.files = argv[index + 1] ?? args.files;
      index += 1;
    } else if (current === "--missing") {
      args.missing = argv[index + 1] ?? args.missing;
      index += 1;
    }
  }

  return args;
}

async function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = await fs.readFile(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeWhitespace(value) {
  return clean(value).replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase();
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

function parseCsv(content) {
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

    if (char === "," && !inQuotes) {
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

function normalizeDate(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return raw;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractYear(value) {
  const match = clean(value).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function meaningfulContactName(value) {
  const normalized = normalizeKey(value);
  if (!normalized || ["contact", "-", "nvt", "n.v.t.", "geen"].includes(normalized)) {
    return "";
  }
  return normalizeWhitespace(value);
}

function looksLikeAddress(value) {
  const normalized = normalizeWhitespace(value);
  return /\d/.test(normalized) || /\bstraat\b|\bweg\b|\blaan\b|\bkade\b|\bdijk\b/i.test(normalized);
}

function extractCityFromAddress(value) {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/\b\d{4}\s?[a-z]{2}\s+(.+)$/i);
  return match ? normalizeWhitespace(match[1]) : "";
}

function parseCustomerBlockGeneric(value) {
  const lines = clean(value)
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const companyName = lines[0] ?? "";
  let address = "";
  let city = "";
  let contactName = "";

  if (lines.length >= 3) {
    contactName = meaningfulContactName(lines.at(-1));
  }

  const middleLines = contactName ? lines.slice(1, -1) : lines.slice(1);

  if (middleLines.length > 0) {
    if (looksLikeAddress(middleLines[0])) {
      address = middleLines[0];
      city = middleLines[1] ?? extractCityFromAddress(middleLines[0]);
    } else {
      city = middleLines[0];
      if (middleLines[1] && looksLikeAddress(middleLines[1])) {
        address = middleLines[1];
      }
    }
  }

  return {
    companyName,
    address: normalizeWhitespace(address),
    city: normalizeWhitespace(city),
    contactName
  };
}

function parseCustomerBlockHoogwerker(value) {
  const lines = clean(value)
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  let companyName = "";
  let city = "";
  let contactName = "";

  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (!companyName) {
      companyName = line;
      continue;
    }
    if (lowered.startsWith("locatie ")) {
      city = line.slice(8).trim();
      continue;
    }
    if (lowered === "locatie") {
      continue;
    }
    if (lowered.startsWith("contact ")) {
      contactName = meaningfulContactName(line.slice(8));
      continue;
    }
    if (!city) {
      city = line;
      continue;
    }
    if (!contactName) {
      contactName = meaningfulContactName(line);
    }
  }

  return { companyName, city, contactName };
}

function buildFallbackMachineNumber(values) {
  return values.map((value) => clean(value)).filter(Boolean).join(" - ");
}

function firstFilled(row, keys) {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return "";
}

function normalizeSerialKey(value) {
  return clean(value).replace(/\s+/g, "").toLowerCase();
}

function isMeaningfulMachineRow(row) {
  return Boolean(
    clean(row.inspectionDate) &&
      clean(row.conclusion) &&
      (
        clean(row.customerName) ||
        clean(row.machineNumber) ||
        clean(row.brand) ||
        clean(row.model) ||
        clean(row.serialNumber) ||
        clean(row.internalNumber)
      )
  );
}

function isMeaningfulBatteryRow(row) {
  return Boolean(
    clean(row.inspectionDate) &&
      clean(row.conclusion) &&
      (
        clean(row.customerName) ||
        clean(row.machineNumber) ||
        clean(row.serialNumber) ||
        clean(row.vehicleSerial)
      )
  );
}

function detectTypeFromFilename(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("batterij")) return "batterij_lader";
  if (lower.includes("hoogwerker")) return "hoogwerker";
  if (lower.includes("stellingmateriaal")) return "stellingmateriaal";
  if (lower.includes("palletwagen")) return "palletwagen_stapelaar";
  if (lower.includes("heftruck-reachtruck")) return "heftruck_reachtruck";
  if (lower.includes("verreiker")) return "verreiker";
  if (lower.includes("shovel")) return "shovel";
  if (lower.includes("graafmachine")) return "graafmachine";
  return "";
}

function mapMachineRow(type, row) {
  const customer = parseCustomerBlockGeneric(row["Bedrijfsgegevens gebruiker"]);
  const inspectionDate = normalizeDate(row["Keuringsdatum"]);
  const serialNumber = clean(row["Serienummer"]);

  if (type === "stellingmateriaal") {
    const rackingType = [row["Soort stelling"], row["Soort stelling__2"], row["Soort stelling__3"]]
      .map((value) => clean(value))
      .filter(Boolean)
      .join(" / ");
    const dossierNumber = clean(row["Dosiernummer"]);
    const zone = clean(row["Gebied"]);

    return {
      customerName: customer.companyName,
      inspectionDate,
      conclusion: clean(row["Conclusie"]),
      machineNumber:
        dossierNumber || buildFallbackMachineNumber([customer.companyName, zone, rackingType, inspectionDate]),
      brand: clean(row["Merk"]) || "Stelling",
      model: rackingType || zone || "Stellingmateriaal",
      serialNumber: "",
      internalNumber: dossierNumber
    };
  }

  return {
    customerName: customer.companyName,
    inspectionDate,
    conclusion: clean(row["Conclusie"]),
    machineNumber:
      serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
    brand: clean(row["Merk"]),
    model: clean(row["Type"]),
    serialNumber,
    internalNumber: ""
  };
}

function chooseHighwerkerMachineNumber(row, customer) {
  const serialNumber = clean(row["Serienummer"]);
  if (serialNumber) {
    return serialNumber;
  }

  return [
    customer.companyName,
    clean(row["Merk"]),
    clean(row["Type"]),
    clean(row["Keuringsdatum"])
  ]
    .filter(Boolean)
    .join(" - ");
}

function mapHoogwerkerRow(row) {
  const customer = parseCustomerBlockHoogwerker(row["Bedrijfsgegevens gebruiker"]);
  return {
    customerName: customer.companyName,
    inspectionDate: normalizeDate(row["Keuringsdatum"]),
    conclusion: clean(row["Conclusie"]),
    machineNumber: chooseHighwerkerMachineNumber(row, customer),
    brand: clean(row["Merk"]),
    model: clean(row["Type"]),
    serialNumber: clean(row["Serienummer"]),
    internalNumber: ""
  };
}

function mapBatteryRow(row) {
  const customer = parseCustomerBlockGeneric(row["Bedrijfsgegevens gebruiker"]);
  const vehicleBrand = clean(row["Merk voertuig"]);
  const vehicleType = clean(row["Type"]);
  const vehicleSerial = clean(row["Serienummer"]);
  const batteryType = clean(row["Batterijtype"]);
  const chargerType = clean(row["Ladertype"]);
  const batteryBrand = firstFilled(row, ["Fabricaat", "Fabrikaat"]);
  const chargerBrand = firstFilled(row, ["Fabricaat__2", "Fabrikaat__2"]);
  const batterySerial = clean(row["Serienummer__2"]);
  const chargerSerial = clean(row["Serienummer__3"]);
  const batteryInternal = clean(row["Intern nummer batterij"]);
  const chargerInternal = clean(row["Intern nummer lader"]);
  const inspectionDate = normalizeDate(row["Keuringsdatum"]);

  return {
    customerName: customer.companyName,
    inspectionDate,
    conclusion: clean(row["Conclusie"]),
    machineNumber:
      batteryInternal ||
      chargerInternal ||
      vehicleSerial ||
      batterySerial ||
      chargerSerial ||
      `${customer.companyName}-${vehicleBrand}-${vehicleType}`.replace(/\s+/g, "-").toLowerCase(),
    brand: batteryBrand || chargerBrand || vehicleBrand || "Batterij / lader",
    model: batteryType || chargerType || vehicleType || "Onbekend",
    serialNumber: batterySerial || chargerSerial || vehicleSerial,
    internalNumber: batteryInternal || chargerInternal || vehicleSerial,
    vehicleSerial: normalizeSerialKey(vehicleSerial)
  };
}

function sourceKey(type, machineNumber, inspectionDate) {
  return `${type}|${normalizeKey(machineNumber)}|${inspectionDate}`;
}

function looseKey(machineNumber, inspectionDate) {
  return `${normalizeKey(machineNumber)}|${inspectionDate}`;
}

async function listSourceFiles(root) {
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(next);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().startsWith("forminator-keuring-") &&
        entry.name.toLowerCase().endsWith(".csv")
      ) {
        files.push(next);
      }
    }
  }

  await walk(root);
  return files.sort((left, right) => left.localeCompare(right, "nl"));
}

async function fetchAll(supabase, table, select) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Ophalen uit ${table} mislukt: ${error.message}`);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n;]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function toCsv(rows, headers) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))
  ].join("\n");
}

function formatSummary({
  sourceRows2026,
  uniqueSourceKeys2026,
  duplicateSourceKeys2026,
  strictMatches,
  looseMatches,
  missingRows,
  fileRows
}) {
  const lines = [
    "# Broncontrole 2026",
    "",
    `- Ruwe bronregels met keuringsdatum in 2026: **${sourceRows2026.length}**`,
    `- Unieke bronkeuringen in 2026 (na ontdubbelen op type + machine + datum): **${uniqueSourceKeys2026.size}**`,
    `- Dubbele bronregels in 2026 over meerdere exports heen: **${duplicateSourceKeys2026.size}**`,
    `- Strikt teruggevonden in database: **${strictMatches.size}**`,
    `- Los teruggevonden in database (zelfde machine + datum, ander type mogelijk): **${looseMatches.size}**`,
    `- Nog niet teruggevonden: **${missingRows.length}**`,
    "",
    "## Per bestand",
    ""
  ];

  for (const row of fileRows) {
    lines.push(
      `- ${row.file_name}: ${row.rows_2026} regels in 2026, ${row.unique_rows_2026} uniek, ${row.missing_rows_2026} niet gevonden`
    );
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const sourceFiles = await listSourceFiles(args.root);
  const sourceRows = [];
  const fileRows = [];

  for (const filePath of sourceFiles) {
    const type = detectTypeFromFilename(filePath);
    if (!type) continue;

    const content = await fs.readFile(filePath, "utf8");
    const parsedRows = parseCsv(content);
    const mappedRows = parsedRows
      .map((row) => {
        if (type === "hoogwerker") return mapHoogwerkerRow(row);
        if (type === "batterij_lader") return mapBatteryRow(row);
        return mapMachineRow(type, row);
      })
      .filter((row) =>
        type === "batterij_lader" ? isMeaningfulBatteryRow(row) : isMeaningfulMachineRow(row)
      )
      .map((row) => ({
        ...row,
        type,
        filePath,
        fileName: path.basename(filePath),
        strictKey: sourceKey(type, row.machineNumber, row.inspectionDate),
        looseKey: looseKey(row.machineNumber, row.inspectionDate)
      }));

    const rows2026 = mappedRows.filter((row) => row.inspectionDate.startsWith("2026-"));
    const unique2026 = new Set(rows2026.map((row) => row.strictKey));

    rows2026.forEach((row) => sourceRows.push(row));

    fileRows.push({
      file_name: path.basename(filePath),
      type,
      total_rows: mappedRows.length,
      rows_2026: rows2026.length,
      unique_rows_2026: unique2026.size,
      missing_rows_2026: 0
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [inspections, machines] = await Promise.all([
    fetchAll(
      supabase,
      "inspections",
      "id, inspection_number, machine_id, machine_type, inspection_date, created_at, status, machine_snapshot"
    ),
    fetchAll(supabase, "machines", "id, machine_number")
  ]);

  const machineNumberById = new Map(machines.map((row) => [String(row.id), String(row.machine_number ?? "")]));
  const dbStrictKeys = new Set();
  const dbLooseKeys = new Set();

  for (const inspection of inspections) {
    const inspectionDate = String(inspection.inspection_date ?? "");
    const type = String(inspection.machine_type ?? "");
    const snapshotNumber = clean(inspection.machine_snapshot?.machine_number);
    const machineNumber = snapshotNumber || machineNumberById.get(String(inspection.machine_id)) || "";

    if (!inspectionDate.startsWith("2026-")) continue;

    dbStrictKeys.add(sourceKey(type, machineNumber, inspectionDate));
    dbLooseKeys.add(looseKey(machineNumber, inspectionDate));
  }

  const uniqueSourceKeys2026 = new Set(sourceRows.map((row) => row.strictKey));
  const duplicateSourceKeys2026 = new Set(
    sourceRows
      .map((row) => row.strictKey)
      .filter((key, index, list) => list.indexOf(key) !== index)
  );

  const strictMatches = new Set();
  const looseMatches = new Set();
  const missingRows = [];

  for (const row of sourceRows) {
    if (dbStrictKeys.has(row.strictKey)) {
      strictMatches.add(row.strictKey);
      looseMatches.add(row.strictKey);
      continue;
    }

    if (dbLooseKeys.has(row.looseKey)) {
      looseMatches.add(row.strictKey);
      continue;
    }

    missingRows.push({
      file_name: row.fileName,
      type: row.type,
      inspection_date: row.inspectionDate,
      customer_name: row.customerName,
      machine_number: row.machineNumber,
      brand: row.brand,
      model: row.model,
      serial_number: row.serialNumber,
      internal_number: row.internalNumber,
      source_key: row.strictKey
    });
  }

  const missingCountByFile = new Map();
  for (const row of missingRows) {
    missingCountByFile.set(row.file_name, (missingCountByFile.get(row.file_name) ?? 0) + 1);
  }

  const finalFileRows = fileRows.map((row) => ({
    ...row,
    missing_rows_2026: missingCountByFile.get(row.file_name) ?? 0
  }));

  await fs.writeFile(
    args.files,
    toCsv(finalFileRows, [
      "file_name",
      "type",
      "total_rows",
      "rows_2026",
      "unique_rows_2026",
      "missing_rows_2026"
    ]),
    "utf8"
  );

  await fs.writeFile(
    args.missing,
    toCsv(missingRows, [
      "file_name",
      "type",
      "inspection_date",
      "customer_name",
      "machine_number",
      "brand",
      "model",
      "serial_number",
      "internal_number",
      "source_key"
    ]),
    "utf8"
  );

  await fs.writeFile(
    args.summary,
    formatSummary({
      sourceRows2026: sourceRows,
      uniqueSourceKeys2026,
      duplicateSourceKeys2026,
      strictMatches,
      looseMatches,
      missingRows,
      fileRows: finalFileRows
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        sourceRows2026: sourceRows.length,
        uniqueSourceKeys2026: uniqueSourceKeys2026.size,
        duplicateSourceKeys2026: duplicateSourceKeys2026.size,
        strictMatches: strictMatches.size,
        looseMatches: looseMatches.size,
        missingRows: missingRows.length,
        summary: args.summary,
        files: args.files,
        missing: args.missing
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
