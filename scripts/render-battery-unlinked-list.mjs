import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    source: path.join(process.cwd(), "Import-batterij-laders-niet-gekoppeld.csv"),
    output: path.join(process.cwd(), "Import-batterij-laders-niet-gekoppeld-overzicht.md")
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source") {
      args.source = argv[index + 1] ?? args.source;
      index += 1;
    } else if (argv[index] === "--output") {
      args.output = argv[index + 1] ?? args.output;
      index += 1;
    }
  }

  return args;
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
  const headers = headerRow.map((header) => String(header ?? "").trim().replace(/^\ufeff/, ""));

  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] ?? ""]))
  );
}

function clean(value) {
  return String(value ?? "").trim();
}

function joinParts(parts) {
  return parts.map(clean).filter(Boolean).join(" | ");
}

function headingFromReason(reason) {
  const label = clean(reason);
  return label || "Onbekende reden";
}

function formatEntry(row, index) {
  const title = joinParts([
    row.klant,
    row.bl_nummer || row.bl_intern_nummer,
    row.bl_merk,
    row.bl_type
  ]);

  const lines = [
    `${index}. **${title || "Onbekende B/L"}**`,
    `   - Keuringsdatum: ${clean(row.keuringsdatum) || "-"}`,
    `   - Reden: ${clean(row.reden) || "-"}`,
    `   - Contactpersoon: ${clean(row.contactpersoon) || "-"}`,
    `   - B/L intern nummer: ${clean(row.bl_intern_nummer) || "-"}`,
    `   - B/L serienummer: ${clean(row.bl_serienummer) || "-"}`,
    `   - Voertuig: ${joinParts([row.voertuig_merk, row.voertuig_type, row.voertuig_bouwjaar]) || "-"}`,
    `   - Voertuig serienummer: ${clean(row.voertuig_serienummer) || "-"}`,
    `   - Batterij serienummer: ${clean(row.batterij_serienummer) || "-"}`,
    `   - Lader serienummer: ${clean(row.lader_serienummer) || "-"}`,
    `   - Bronregel CSV: ${clean(row.bronregel) || "-"}`
  ];

  if (clean(row.mogelijke_machines)) {
    lines.push(`   - Mogelijke machines: ${clean(row.mogelijke_machines)}`);
  }

  return lines.join("\n");
}

async function main() {
  const { source, output } = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(path.resolve(source), "utf8");
  const rows = parseCsv(raw);

  const groups = new Map();
  for (const row of rows) {
    const key = headingFromReason(row.reden);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  const sortedGroups = Array.from(groups.entries()).sort((left, right) =>
    left[0].localeCompare(right[0], "nl")
  );

  const lines = [
    "# Niet gekoppelde batterijen en laders",
    "",
    `Totaal open punten: **${rows.length}**`,
    ""
  ];

  for (const [reason, items] of sortedGroups) {
    lines.push(`## ${reason} (${items.length})`, "");
    items.forEach((row, index) => {
      lines.push(formatEntry(row, index + 1), "");
    });
  }

  await fs.writeFile(path.resolve(output), `${lines.join("\n").trimEnd()}\n`, "utf8");
  console.log(`Overzicht aangemaakt: ${path.resolve(output)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
