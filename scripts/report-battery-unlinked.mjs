import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {
    source: "",
    output: path.join(process.cwd(), "Import-batterij-laders-niet-gekoppeld.csv")
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source") {
      args.source = argv[index + 1] ?? "";
      index += 1;
    } else if (argv[index] === "--output") {
      args.output = argv[index + 1] ?? args.output;
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

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function clean(value) {
  return decodeHtmlEntities(String(value ?? ""))
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

function normalizeSerialKey(value) {
  return clean(value)
    .replace(/\s+/g, "")
    .toLowerCase();
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

  return dataRows.map((values, index) => ({
    __source_row: index + 2,
    ...Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] ?? ""]))
  }));
}

function firstFilled(row, keys) {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function parseCustomerBlock(value) {
  const lines = clean(value)
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  let companyName = "";
  let address = "";
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
      contactName = line.slice(8).trim();
      continue;
    }
    if (!address && /\d/.test(line) && (line.includes(",") || /\b\d{4}\s?[a-z]{2}\b/i.test(line))) {
      address = line;
      continue;
    }
    if (!city) {
      city = line;
      continue;
    }
    if (!contactName) {
      contactName = line;
    }
  }

  return { companyName, address, city, contactName };
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

function compactConfig(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => clean(value))
  );
}

function isMeaningfulRow(row) {
  return Boolean(
    clean(row.inspectionDate) &&
      clean(row.conclusion) &&
      (
        clean(row.customerName) ||
        clean(row.machine.machineNumber) ||
        clean(row.machine.serialNumber) ||
        clean(row.machine.configuration.vehicle_serial_number) ||
        clean(row.machine.configuration.battery_serial_number) ||
        clean(row.machine.configuration.charger_serial_number)
      )
  );
}

function pushMapValue(map, key, value) {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(value);
  map.set(key, current);
}

function mapRow(row) {
  const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
  const vehicleBrand = clean(row["Merk voertuig"]);
  const vehicleType = clean(row["Type"]);
  const vehicleBuildYear = clean(row["Bouwjaar voertuig"]);
  const vehicleSerial = clean(row["Serienummer"]);
  const batteryType = clean(row["Batterijtype"]);
  const chargerType = clean(row["Ladertype"]);
  const batteryBrand = firstFilled(row, ["Fabricaat", "Fabrikaat"]);
  const chargerBrand = firstFilled(row, ["Fabricaat__2", "Fabrikaat__2"]);
  const batterySerial = clean(row["Serienummer__2"]);
  const chargerSerial = clean(row["Serienummer__3"]);
  const batteryInternal = clean(row["Intern nummer batterij"]);
  const chargerInternal = clean(row["Intern nummer lader"]);
  const machineNumber =
    batteryInternal ||
    chargerInternal ||
    vehicleSerial ||
    batterySerial ||
    chargerSerial ||
    `${customer.companyName}-${vehicleBrand}-${vehicleType}`.replace(/\s+/g, "-").toLowerCase();

  return {
    sourceRow: row.__source_row,
    customerName: customer.companyName,
    customerAddress: customer.address,
    customerCity: customer.city,
    customerContact: customer.contactName,
    customerEmail: clean(row["E-mailadres gebruiker"]),
    inspectionDate: normalizeDate(row["Keuringsdatum"]),
    conclusion: clean(row["Conclusie"]),
    vehicleSerialKey: normalizeSerialKey(vehicleSerial),
    machine: {
      machineNumber,
      brand: batteryBrand || chargerBrand || vehicleBrand || "Batterij / lader",
      model: batteryType || chargerType || vehicleType || "Onbekend",
      serialNumber: batterySerial || chargerSerial || vehicleSerial,
      buildYear: extractYear(vehicleBuildYear),
      internalNumber: batteryInternal || chargerInternal || vehicleSerial,
      configuration: compactConfig({
        vehicle_brand: vehicleBrand,
        vehicle_type: vehicleType,
        vehicle_build_year: vehicleBuildYear,
        vehicle_serial_number: vehicleSerial,
        battery_type: batteryType,
        battery_brand: batteryBrand,
        battery_serial_number: batterySerial,
        battery_internal_number: batteryInternal,
        charger_type: chargerType,
        charger_brand: chargerBrand,
        charger_serial_number: chargerSerial,
        charger_internal_number: chargerInternal
      })
    }
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function formatMachineLabel(machine, customersById) {
  const customer = customersById.get(machine.customerId);
  const bits = [
    machine.internalNumber || machine.machineNumber || "-",
    [machine.brand, machine.model].filter(Boolean).join(" ").trim() || "Machine",
    machine.serialNumber || "-",
    customer?.companyName || "Onbekende klant"
  ];
  return bits.join(" | ");
}

async function main() {
  const { source, output } = parseArgs(process.argv.slice(2));

  if (!source) {
    throw new Error("Gebruik --source met het pad naar het batterij/lader bronbestand.");
  }

  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const raw = await fs.readFile(path.resolve(source), "utf8");
  const parsedRows = parseCsv(raw).map(mapRow).filter(isMeaningfulRow);

  const [customerRows, machineRows] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("machines").select("*")
  ]);

  const customersById = new Map(
    (customerRows.data ?? []).map((row) => [
      String(row.id),
      {
        id: String(row.id),
        companyName: String(row.company_name ?? "")
      }
    ])
  );

  const machinesByNumber = new Map();
  const machinesById = new Map();
  const exactVehicleMatches = new Map();

  for (const row of machineRows.data ?? []) {
    const machine = {
      id: String(row.id),
      customerId: String(row.customer_id ?? ""),
      machineNumber: String(row.machine_number ?? ""),
      internalNumber: String(row.internal_number ?? ""),
      machineType: String(row.machine_type ?? ""),
      brand: String(row.brand ?? ""),
      model: String(row.model ?? ""),
      serialNumber: String(row.serial_number ?? ""),
      configuration: row.configuration ?? {}
    };

    machinesByNumber.set(normalizeKey(machine.machineNumber), machine);
    machinesById.set(machine.id, machine);

    const serialKey = normalizeSerialKey(machine.serialNumber);
    if (machine.machineType !== "batterij_lader" && serialKey) {
      pushMapValue(exactVehicleMatches, serialKey, machine);
    }
  }

  const unresolved = [];
  const reasonCounts = {
    missingCustomer: 0,
    noVehicleSerial: 0,
    noMatch: 0,
    ambiguous: 0
  };

  for (const row of parsedRows) {
    const machineKey = normalizeKey(row.machine.machineNumber);
    const existingBatteryCharger = machinesByNumber.get(machineKey) ?? null;
    const matchedVehicles = row.vehicleSerialKey
      ? exactVehicleMatches.get(row.vehicleSerialKey) ?? []
      : [];
    const exactLinkedMachine = matchedVehicles.length === 1 ? matchedVehicles[0] : null;
    const preservedLinkedMachineId =
      exactLinkedMachine?.id ||
      String(existingBatteryCharger?.configuration?.linked_machine_id ?? "").trim();
    const preservedLinkedMachine = preservedLinkedMachineId
      ? machinesById.get(preservedLinkedMachineId) ?? null
      : null;

    if (exactLinkedMachine || preservedLinkedMachine) {
      continue;
    }

    let reason = "";
    let reasonLabel = "";

    if (!row.customerName) {
      reason = "missing_customer";
      reasonLabel = "Klant ontbreekt";
      reasonCounts.missingCustomer += 1;
    } else if (!row.vehicleSerialKey) {
      reason = "no_vehicle_serial";
      reasonLabel = "Geen voertuig-serienummer";
      reasonCounts.noVehicleSerial += 1;
    } else if (matchedVehicles.length > 1) {
      reason = "ambiguous_match";
      reasonLabel = "Meerdere mogelijke machines";
      reasonCounts.ambiguous += 1;
    } else {
      reason = "no_match";
      reasonLabel = "Geen machine-match gevonden";
      reasonCounts.noMatch += 1;
    }

    unresolved.push({
      reason,
      reasonLabel,
      sourceRow: row.sourceRow,
      inspectionDate: row.inspectionDate,
      customerName: row.customerName,
      customerContact: row.customerContact,
      batteryChargerNumber: row.machine.machineNumber,
      batteryChargerInternalNumber: row.machine.internalNumber,
      batteryChargerBrand: row.machine.brand,
      batteryChargerType: row.machine.model,
      batteryChargerSerialNumber: row.machine.serialNumber,
      vehicleBrand: row.machine.configuration.vehicle_brand ?? "",
      vehicleType: row.machine.configuration.vehicle_type ?? "",
      vehicleBuildYear: row.machine.configuration.vehicle_build_year ?? "",
      vehicleSerialNumber: row.machine.configuration.vehicle_serial_number ?? "",
      batterySerialNumber: row.machine.configuration.battery_serial_number ?? "",
      chargerSerialNumber: row.machine.configuration.charger_serial_number ?? "",
      candidateCount: matchedVehicles.length,
      candidateMachines: matchedVehicles
        .map((machine) => formatMachineLabel(machine, customersById))
        .join(" || ")
    });
  }

  unresolved.sort((left, right) => {
    if (left.reasonLabel !== right.reasonLabel) {
      return left.reasonLabel.localeCompare(right.reasonLabel, "nl");
    }
    if (left.customerName !== right.customerName) {
      return left.customerName.localeCompare(right.customerName, "nl");
    }
    return left.inspectionDate.localeCompare(right.inspectionDate);
  });

  const headers = [
    "reden_code",
    "reden",
    "bronregel",
    "keuringsdatum",
    "klant",
    "contactpersoon",
    "bl_nummer",
    "bl_intern_nummer",
    "bl_merk",
    "bl_type",
    "bl_serienummer",
    "voertuig_merk",
    "voertuig_type",
    "voertuig_bouwjaar",
    "voertuig_serienummer",
    "batterij_serienummer",
    "lader_serienummer",
    "kandidaat_aantal",
    "mogelijke_machines"
  ];

  const csvLines = [
    headers.join(","),
    ...unresolved.map((row) =>
      [
        row.reason,
        row.reasonLabel,
        row.sourceRow,
        row.inspectionDate,
        row.customerName,
        row.customerContact,
        row.batteryChargerNumber,
        row.batteryChargerInternalNumber,
        row.batteryChargerBrand,
        row.batteryChargerType,
        row.batteryChargerSerialNumber,
        row.vehicleBrand,
        row.vehicleType,
        row.vehicleBuildYear,
        row.vehicleSerialNumber,
        row.batterySerialNumber,
        row.chargerSerialNumber,
        row.candidateCount,
        row.candidateMachines
      ]
        .map(csvEscape)
        .join(",")
    )
  ];

  await fs.writeFile(path.resolve(output), `\ufeff${csvLines.join("\n")}`, "utf8");

  console.log("Rapport aangemaakt.");
  console.log(
    JSON.stringify(
      {
        output: path.resolve(output),
        unresolvedCount: unresolved.length,
        ...reasonCounts
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
