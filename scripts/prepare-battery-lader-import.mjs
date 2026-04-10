import fs from "node:fs/promises";
import path from "node:path";

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function collapseLines(value) {
  return clean(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" | ");
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

function normalizeInspectionDate(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return raw;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseCustomerBlock(value) {
  const lines = clean(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let companyName = "";
  let city = "";
  let contactName = "";

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ").trim();
    const lowered = normalized.toLowerCase();

    if (!companyName) {
      companyName = normalized;
      continue;
    }

    if (lowered.startsWith("locatie ")) {
      city = normalized.slice(8).trim();
      continue;
    }

    if (lowered === "locatie") {
      continue;
    }

    if (lowered.startsWith("contact ")) {
      contactName = normalized.slice(8).trim();
      continue;
    }

    if (!city) {
      city = normalized;
      continue;
    }

    if (!contactName) {
      contactName = normalized;
    }
  }

  return { companyName, city, contactName };
}

function mapSourceRow(row, index) {
  const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);

  return {
    bron_rij: String(index + 2),
    machine_type: "batterij_lader",
    customer_name: customer.companyName,
    customer_city: customer.city,
    customer_contact: customer.contactName,
    customer_email: "",
    customer_phone: "",
    vehicle_brand: clean(row["Merk voertuig"]),
    vehicle_type: clean(row["Type"]),
    vehicle_build_year: clean(row["Bouwjaar voertuig"]),
    vehicle_internal_number: "",
    vehicle_serial_number: clean(row["Serienummer"]),
    battery_type: clean(row["Batterijtype"]),
    battery_brand: clean(row["Fabricaat"]),
    battery_serial_number: clean(row["Serienummer__2"]),
    battery_internal_number: clean(row["Intern nummer batterij"]),
    charger_type: clean(row["Ladertype"]),
    charger_brand: clean(row["Fabricaat__2"]),
    charger_serial_number: clean(row["Serienummer__3"]),
    charger_internal_number: clean(row["Intern nummer lader"]),
    drawing_number: clean(row["Tekening nummer"]),
    charger_voltage: clean(row["Netspanning"]),
    double_insulated: clean(row["Dubbel geïsoleerd"]),
    inspection_date: normalizeInspectionDate(row["Keuringsdatum"]),
    findings: clean(row["Bevindingen"]),
    recommendations: clean(row["Aanbevelingen"]),
    conclusion: clean(row["Conclusie"]),
    source_submission_time: clean(row["Inzendingstijd"]),
    source_customer_block: collapseLines(row["Bedrijfsgegevens gebruiker"])
  };
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))
  ].join("\n");
}

function parseArgs(argv) {
  const args = { source: "", output: "" };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source") {
      args.source = argv[index + 1] ?? "";
      index += 1;
    } else if (argv[index] === "--output") {
      args.output = argv[index + 1] ?? "";
      index += 1;
    }
  }

  return args;
}

async function main() {
  const { source, output } = parseArgs(process.argv.slice(2));

  if (!source) {
    throw new Error("Gebruik --source met het pad naar het Forminator CSV-bestand.");
  }

  const sourcePath = path.resolve(source);
  const outputPath = path.resolve(
    output || path.join(process.cwd(), "Import-batterij-laders-bulk.csv")
  );

  const raw = await fs.readFile(sourcePath, "utf8");
  const rows = parseCsv(raw)
    .map(mapSourceRow)
    .filter((row) => row.customer_name || row.vehicle_brand || row.battery_brand || row.charger_brand);

  await fs.writeFile(outputPath, `${toCsv(rows)}\n`, "utf8");

  console.log(`Bronbestand gelezen: ${sourcePath}`);
  console.log(`Rijen verwerkt: ${rows.length}`);
  console.log(`Importbestand geschreven: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
