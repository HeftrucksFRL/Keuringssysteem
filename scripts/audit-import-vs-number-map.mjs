import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  return dataRows.map((values) =>
    Object.fromEntries(
      headerRow.map((header, index) => [
        String(header ?? "").replace(/^\uFEFF/, ""),
        values[index] ?? ""
      ])
    )
  );
}

async function fetchAllInspectionNumbers(supabase) {
  const allRows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("inspections")
      .select("inspection_number")
      .range(from, to);

    if (error) {
      throw new Error(`Inspecties ophalen mislukt: ${error.message}`);
    }

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

function inspectionYear(row) {
  const inspectionDate = String(row.inspection_date ?? "").trim();
  const dateMatch = inspectionDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dateMatch) {
    return dateMatch[3];
  }

  const submissionMinute = String(row.source_submission_minute ?? "").trim();
  if (submissionMinute.length >= 4) {
    return submissionMinute.slice(0, 4);
  }

  return "";
}

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const matchesPath = path.join(process.cwd(), "Herimport keuringsapp", "Import-nummer-matches.csv");
  const raw = await fs.readFile(matchesPath, "utf8");
  const rows = parseCsv(raw, ";");

  const expected = new Map(
    rows.map((row) => {
      const year = inspectionYear(row);
      const inspectionNumber =
        year && row.oud_nummer ? `${year}${String(row.oud_nummer).padStart(4, "0")}` : "";
      return [String(inspectionNumber), row];
    })
  );

  const inspectionRows = await fetchAllInspectionNumbers(supabase);
  const actualNumbers = new Set(
    inspectionRows.map((row) => String(row.inspection_number ?? ""))
  );

  const missing = [...expected.entries()]
    .filter(([inspectionNumber]) => inspectionNumber && !actualNumbers.has(inspectionNumber))
    .map(([, row]) => row);

  const byFile = new Map();
  for (const row of missing) {
    const key = row.file_name;
    byFile.set(key, (byFile.get(key) ?? 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        expected: expected.size,
        actual: actualNumbers.size,
        missing: missing.length,
        missingByFile: [...byFile.entries()].map(([file, count]) => ({ file, count }))
      },
      null,
      2
    )
  );

  const outputPath = path.join(process.cwd(), "Herimport keuringsapp", "Import-nummer-nog-missend.csv");
  const header = [
    "file_name",
    "row_number",
    "inspection_type",
    "source_submission_time",
    "inspection_date",
    "customer_name",
    "brand",
    "model",
    "serial_number",
    "oud_nummer"
  ];
  const lines = [header.join(";")];
  for (const row of missing) {
    lines.push(
      header
        .map((column) => {
          const value = String(row[column] ?? "");
          return value.includes(";") || value.includes("\n") ? `"${value.replaceAll('"', '""')}"` : value;
        })
        .join(";")
    );
  }
  await fs.writeFile(outputPath, `\uFEFF${lines.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
