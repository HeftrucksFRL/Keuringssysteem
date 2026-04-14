import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STOCK_CUSTOMER_COMPANY = "Heftrucks.frl";
const STOCK_CUSTOMER_EMAIL = "info@heftrucks.frl";
const STOCK_CUSTOMER_PHONE = "0653842843";

function parseArgs(argv) {
  const args = { source: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source") {
      args.source = argv[index + 1] ?? "";
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

async function hasColumn(supabase, table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  if (!error) {
    return true;
  }

  if (
    error.message?.includes(`Could not find the '${column}' column`) ||
    error.message?.includes(`column ${table}.${column} does not exist`)
  ) {
    return false;
  }

  throw new Error(`Kolomcontrole mislukt voor ${table}.${column}: ${error.message}`);
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

function addTwelveMonths(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const targetMonth = date.getMonth() + 12;
  const day = date.getDate();
  date.setMonth(targetMonth);
  while (date.getDate() !== day) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function planningStateForDueDate(dueDate) {
  return dueDate < todayIso() ? "overdue" : "scheduled";
}

function extractYear(value) {
  const match = clean(value).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function normalizeChecklistValue(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return "nvt";
  if (normalized.startsWith("goed")) return "goed";
  if (
    normalized.includes("slecht") ||
    normalized.includes("afkeur") ||
    normalized.includes("matig")
  ) {
    return "slecht";
  }
  if (normalized.includes("n.v.t") || normalized.includes("nvt")) return "nvt";
  return "nvt";
}

function deriveStatus(conclusion) {
  const normalized = normalizeKey(conclusion);
  if (normalized.includes("afgekeurd")) return "rejected";
  if (normalized.includes("behandeling")) return "draft";
  return "approved";
}

function compactConfig(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => clean(value))
  );
}

function buildCustomerSnapshot(customer) {
  return {
    customer_name: customer.companyName,
    customer_address: customer.address,
    customer_contact: customer.contactName,
    customer_contact_department: customer.contactDepartment ?? "",
    customer_phone: customer.phone,
    customer_email: customer.email
  };
}

function buildMachineSnapshot(machine) {
  return {
    machine_number: machine.machineNumber,
    brand: machine.brand,
    model: machine.model,
    serial_number: machine.serialNumber,
    build_year: machine.buildYear,
    internal_number: machine.internalNumber,
    ...machine.configuration
  };
}

function mergeText(existingValue, nextValue) {
  const existing = clean(existingValue);
  if (existing) {
    return existing;
  }
  return clean(nextValue);
}

function mergeConfiguration(existingConfig, incomingConfig) {
  const merged = { ...incomingConfig };
  for (const [key, value] of Object.entries(existingConfig ?? {})) {
    if (clean(value)) {
      merged[key] = String(value);
    }
  }
  return compactConfig(merged);
}

function meaningfulContactName(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (["contact", "-", "nvt", "n.v.t.", "geen"].includes(normalized)) {
    return "";
  }
  return normalizeWhitespace(value);
}

function parseCustomerBlock(value) {
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

function isStockCustomerName(companyName) {
  const normalized = normalizeKey(companyName);
  return normalized.includes("heftrucks") || normalized.includes("friesland");
}

const checklistMap = {
  "a) Hoogwerkerboek": "hoogwerkerboek",
  "b) Werklast/vlucht-grafiek/-label": "werklast_vlucht_grafiek",
  "c) CE Conformiteitsverklaring": "ce_conformiteit",
  "d) Bedieningsvoorschift": "bedieningsvoorschrift",
  "e) Montagevoorschift": "montagevoorschrift",
  "f) Onderhoudsvoorschift": "onderhoudsvoorschrift",
  "g) Elektrisch schema": "elektrisch_schema",
  "a) Bedieningshendels/ nulstandvergrendeling": "bedieningshendels",
  "b) Instrumenten": "instrumenten",
  "c) Aanduidingen": "aanduidingen",
  "d) Aanduidingen werklast": "aanduidingen_werklast",
  "e) Tabellen werklast": "tabellen_werklast",
  "f) Contactslot/noodstop": "contactslot_noodstop",
  "g) Beweging niet meer mogelijk": "beweging_niet_meer_mogelijk",
  "h) Controle horizontaal waterpas": "controle_waterpas",
  "i) Veiligheid machinist": "veiligheid_machinist",
  "j) Noodbediening": "noodbediening",
  "a) Opstappen ladders": "opstappen_ladders",
  "b) Bordessen loopvlakken": "bordessen_loopvlakken",
  "c) Handgrepen": "handgrepen",
  "d) Antislip": "antislip",
  "a) Elektrische bedrading": "elektrische_bedrading",
  "b) Hoofdschakelaar": "hoofdschakelaar",
  "c) Sleepringinrichting": "sleepringinrichting",
  "d) Schakelkasten": "schakelkasten",
  "e) Apparatuur": "apparatuur",
  "b) Motoren": "motoren",
  "c) Pompen": "pompen",
  "d) Ventielen": "ventielen",
  "e) Slangbreukventielen": "slangbreukventielen",
  "f) Stabiliteit 1 uur gegarandeerd": "stabiliteit_1_uur",
  "g) Werkbak verplaatsing max 0.1 mtr in 10 min.": "werkbak_verplaatsing",
  "a) Ophanging / vering vooras": "ophanging_vering_vooras",
  "b) Ophanging / vering achteras": "ophanging_vering_achteras",
  "c) Wielbouten moeren": "wielbouten_moeren",
  "d) Bandengesteldheid": "bandengesteldheid",
  "e) Blokkering pendelas": "blokkering_pendelas",
  "a) Stuurspeling": "stuurspeling",
  "b) Stuurassen": "stuurassen",
  "a) Parkeerrem": "parkeerrem",
  "b) Bedrijfsrem": "bedrijfsrem",
  "c) Automatische rem": "automatische_rem",
  "d) Remcilinders": "remcilinders",
  "e) Leidingen koppelingen": "leidingen_koppelingen",
  "f) Slangen": "slangen",
  "a) Draaikrans": "draaikrans",
  "b) Bevestiging": "bevestiging",
  "c) Bonkelaar": "bonkelaar",
  "d) Aandrijving / lagering": "aandrijving_lagering",
  "e) Koppeling": "koppeling",
  "f) Rem": "rem",
  "g) Pal": "pal",
  "a) Telescoop / schaartoren": "telescoop_schaartoren",
  "b) Constructie / lassen": "constructie_lassen",
  "c) Bevestiging aan frame": "bevestiging_frame",
  "d) Bout / penverbindingen": "bout_penverbindingen",
  "e) Telescopeerkabel / ketting": "telescopeerkabel_ketting",
  "f) Bevestiging / borging": "bevestiging_borging",
  "g) Vanginrichting": "vanginrichting",
  "h) Paralelgeleiding": "paralelgeleiding",
  "i) Elektrische kabels": "elektrische_kabels",
  "j) Top knik hefcilinders": "top_knik_hefcilinders",
  "K) Veiligheidskleppen": "veiligheidskleppen",
  "l) Telescoopcilinders": "telescoopcilinders",
  "n) Geleiding telescopeergiek": "geleiding_telescopeergiek",
  "o) Parallel geleidingscilinder": "parallel_geleidingscilinder",
  "q) Slangen / leidingen / koppelingen": "slangen_leidingen_koppelingen",
  "r) Beveiliging schaar 1.5 mtr hoog": "beveiliging_schaar",
  "a) Constructie / lassen": "constructie_onderwagen_lassen",
  "b) Bout / penverbindingen": "constructie_onderwagen_bout",
  "a) Constructie / lassen__2": "constructie_bovenwagen_lassen",
  "b) Bout / penverbindingen__2": "constructie_bovenwagen_bout",
  "a) Constructie / lassen__3": "bak_constructie_lassen",
  "b) Bevestiging__2": "bak_bevestiging",
  "c) Bout / penverbindingen": "bak_bout_penverbindingen",
  "d) Afsluiting deur": "afsluiting_deur",
  "e) Zwenkrichting bak": "zwenkrichting_bak",
  "f) Borging": "bak_borging",
  "g) Horizontaal stelling": "horizontaal_stelling",
  "h) Veiligheidsgordel": "bak_veiligheidsgordel",
  "a) Uithouders": "uithouders",
  "b) Borging": "uithouders_borging",
  "c) Cilinders": "cilinders",
  "d) Stempelcilinders / spindels": "stempelcilinders_spindels",
  "e) Leidingbreukventielen": "leidingbreukventielen",
  "f) Borging__2": "borgingen",
  "g) Stempelvoeten": "stempelvoeten",
  "h) Borgingen": "borgingen",
  "a) Bevestiging": "electromotoren_bevestiging",
  "b) Sleepringen": "sleepringen",
  "d) Elektrische aansluitingen": "elektrische_aansluitingen",
  "c) Koolborstels": "koolborstels",
  "e) Aarding": "aarding",
  "a) Rijwerk": "rijwerk",
  "b) Optoppen / hoogste stand": "optoppen_hoogste_stand",
  "c) Aftoppen / laagste stand": "aftoppen_laagste_stand",
  "d) Inknikken/ intelescoperen": "inknikken",
  "e) Uitknikken / uittelescoperen": "uitknikken",
  "f) Zwenkhoekbegrenzer": "zwenkhoekbegrenzer",
  "g) Lastbegrenzer": "lastbegrenzer",
  "h) Lastmomentbegrenzer": "lastmomentbegrenzer",
  "i) Vluchtbegrenzer": "vluchtbegrenzer",
  "j) Contraballasbegrenzer": "contraballasbegrenzer",
  "k) Rijsnelheidbegrenzer": "rijsnelheidbegrenzer",
  "l) Uitsch. heffen bij scheefstand > 3 graden of signaal": "scheefstand_signaal",
  "a) Bevestiging ballast": "bevestiging_ballast",
  "b) Massa ballast iom hoogwerkerboek": "massa_ballast",
  "c) verfwerk": "verfwerk",
  "d) Waarschuwingskleuren": "waarschuwingskleuren",
  "e) Identificatie": "identificatie",
  "f) Bandenspanning": "bandenspanning",
  "a) Op stempels": "op_stempels",
  "b) Stationair": "stationair",
  "c) Mobiel": "mobiel"
};

function buildChecklist(row) {
  return Object.fromEntries(
    Object.entries(checklistMap).map(([sourceKey, targetKey]) => [
      targetKey,
      normalizeChecklistValue(row[sourceKey])
    ])
  );
}

function chooseMachineNumber(row, customer) {
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

function mapRow(row) {
  const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
  const companyName = customer.companyName || "Onbekende klant";
  const brand = clean(row["Merk"]);
  const model = clean(row["Type"]);
  const serialNumber = clean(row["Serienummer"]);
  const buildYear = extractYear(row["Bouwjaar"]);
  const inspectionDate = normalizeDate(row["Keuringsdatum"]);
  const configuration = compactConfig({
    undercarriage: clean(row["Onderwagen"]),
    setup: clean(row["Opstelling"]),
    platform_type: clean(row["Hoogwerker"]),
    drive_type: clean(row["Aandrijving"]),
    max_payload: clean(row["Werkbak max. werklast"]),
    max_outreach: clean(row["Werkbak max. Vlucht"]),
    max_height: clean(row["Werkbak max. vloerhoogte"]),
    max_persons: clean(row["Aantal personen"])
  });
  const snapshotConfiguration = compactConfig({
    ...configuration,
    sticker_number: clean(row["Stickernummer"])
  });

  return {
    customerName: companyName,
    isStockCustomer: isStockCustomerName(companyName),
    customerCity: customer.city,
    customerContact: customer.contactName,
    customerEmail: clean(row["E-mailadres gebruiker"]),
    inspectionDate,
    findings: clean(row["Bevindingen"]),
    recommendations: clean(row["Aanbevelingen"]),
    conclusion: clean(row["Conclusie"]),
    status: deriveStatus(row["Conclusie"]),
    machine: {
      machineNumber: chooseMachineNumber(row, customer),
      brand,
      model,
      serialNumber,
      buildYear,
      internalNumber: "",
      configuration,
      snapshotConfiguration
    },
    checklist: buildChecklist(row)
  };
}

function sortRowsChronologically(rows) {
  return [...rows].sort((left, right) => {
    const dateCompare = left.inspectionDate.localeCompare(right.inspectionDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return normalizeKey(left.machine.machineNumber).localeCompare(
      normalizeKey(right.machine.machineNumber)
    );
  });
}

async function ensureStockCustomer(supabase, customersByName) {
  const preferredKeys = [
    normalizeKey(STOCK_CUSTOMER_COMPANY),
    normalizeKey("Heftrucks Friesland B.V"),
    normalizeKey("Heftrucks Friesland BV")
  ];

  for (const key of preferredKeys) {
    const existing = customersByName.get(key);
    if (existing) {
      customersByName.set(normalizeKey(STOCK_CUSTOMER_COMPANY), existing);
      return existing;
    }
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_name: STOCK_CUSTOMER_COMPANY,
      address_line_1: "",
      city: "",
      contact_name: "Eigen voorraad",
      phone: STOCK_CUSTOMER_PHONE,
      email: STOCK_CUSTOMER_EMAIL
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Voorraadeigenaar aanmaken mislukt: ${error?.message ?? "onbekende fout"}`);
  }

  const customer = {
    id: String(data.id),
    companyName: String(data.company_name ?? ""),
    address: String(data.address_line_1 ?? ""),
    city: String(data.city ?? ""),
    contactName: String(data.contact_name ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? "")
  };

  customersByName.set(normalizeKey(STOCK_CUSTOMER_COMPANY), customer);
  customersByName.set(normalizeKey("Heftrucks Friesland B.V"), customer);
  customersByName.set(normalizeKey("Heftrucks Friesland BV"), customer);
  return customer;
}

function pushMapValue(map, key, value) {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(value);
  map.set(key, current);
}

function replaceMachinePlanningCache(cache, machineId, item) {
  cache.set(machineId, item ? [item] : []);
}

async function syncPlanningItem(supabase, planningByMachineId, input) {
  const existingItems = planningByMachineId.get(input.machineId) ?? [];
  const targetItem =
    existingItems.find((item) => item.inspectionId === input.inspectionId) ??
    existingItems[0] ??
    null;
  const state = planningStateForDueDate(input.dueDate);

  if (!targetItem) {
    const { data, error } = await supabase
      .from("planning_items")
      .insert({
        inspection_id: input.inspectionId,
        customer_id: input.customerId,
        machine_id: input.machineId,
        due_date: input.dueDate,
        state
      })
      .select("id, inspection_id, customer_id, machine_id, due_date, state")
      .single();

    if (error || !data) {
      throw new Error(`Planning aanmaken mislukt: ${error?.message ?? "onbekende fout"}`);
    }

    replaceMachinePlanningCache(planningByMachineId, input.machineId, {
      id: String(data.id),
      inspectionId: String(data.inspection_id ?? ""),
      customerId: String(data.customer_id ?? ""),
      machineId: String(data.machine_id ?? ""),
      dueDate: String(data.due_date ?? ""),
      state: String(data.state ?? "")
    });

    return "created";
  }

  const { error: updateError } = await supabase
    .from("planning_items")
    .update({
      inspection_id: input.inspectionId,
      customer_id: input.customerId,
      machine_id: input.machineId,
      due_date: input.dueDate,
      state
    })
    .eq("id", targetItem.id);

  if (updateError) {
    throw new Error(`Planning bijwerken mislukt: ${updateError.message}`);
  }

  const duplicateIds = existingItems
    .filter((item) => item.id !== targetItem.id)
    .map((item) => item.id);

  if (duplicateIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("planning_items")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      throw new Error(`Dubbele planning verwijderen mislukt: ${deleteError.message}`);
    }
  }

  replaceMachinePlanningCache(planningByMachineId, input.machineId, {
    id: targetItem.id,
    inspectionId: input.inspectionId,
    customerId: input.customerId,
    machineId: input.machineId,
    dueDate: input.dueDate,
    state
  });

  return "updated";
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2));
  if (!source) {
    throw new Error("Gebruik --source met het pad naar het hoogwerker bronbestand.");
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

  const supportsContactDepartment = await hasColumn(supabase, "customer_contacts", "department");

  const raw = await fs.readFile(path.resolve(source), "utf8");
  const parsedRows = sortRowsChronologically(
    parseCsv(raw)
      .map(mapRow)
      .filter((row) => row.customerName && row.machine.machineNumber && row.inspectionDate)
  );

  const [customerRows, contactRows, machineRows, inspectionRows, planningRows] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("customer_contacts").select("*"),
    supabase.from("machines").select("*"),
    supabase.from("inspections").select("id, machine_id, inspection_date"),
    supabase.from("planning_items").select("*").neq("state", "completed")
  ]);

  const customersByName = new Map(
    (customerRows.data ?? []).map((row) => [
      normalizeKey(row.company_name),
      {
        id: String(row.id),
        companyName: String(row.company_name ?? ""),
        address: String(row.address_line_1 ?? ""),
        city: String(row.city ?? ""),
        contactName: String(row.contact_name ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? "")
      }
    ])
  );

  const contactsByCustomerId = new Map();
  for (const row of contactRows.data ?? []) {
    const customerId = String(row.customer_id);
    const list = contactsByCustomerId.get(customerId) ?? [];
    list.push({
      id: String(row.id),
      name: String(row.name ?? ""),
      isPrimary: Boolean(row.is_primary)
    });
    contactsByCustomerId.set(customerId, list);
  }

  const machinesByNumber = new Map();
  const machinesBySerial = new Map();
  for (const row of machineRows.data ?? []) {
    const machine = {
      id: String(row.id),
      customerId: String(row.customer_id),
      machineNumber: String(row.machine_number ?? ""),
      brand: String(row.brand ?? ""),
      model: String(row.model ?? ""),
      serialNumber: String(row.serial_number ?? ""),
      buildYear: String(row.build_year ?? ""),
      internalNumber: String(row.internal_number ?? ""),
      configuration: row.configuration ?? {}
    };

    const numberKey = normalizeKey(machine.machineNumber);
    const serialKey = normalizeKey(machine.serialNumber);
    if (numberKey) machinesByNumber.set(numberKey, machine);
    if (serialKey && !machinesBySerial.has(serialKey)) machinesBySerial.set(serialKey, machine);
  }

  const inspectionByKey = new Map(
    (inspectionRows.data ?? []).map((row) => [
      `${String(row.machine_id)}|${String(row.inspection_date)}`,
      String(row.id)
    ])
  );

  const planningByMachineId = new Map();
  for (const row of planningRows.data ?? []) {
    pushMapValue(planningByMachineId, String(row.machine_id), {
      id: String(row.id),
      inspectionId: String(row.inspection_id ?? ""),
      customerId: String(row.customer_id ?? ""),
      machineId: String(row.machine_id ?? ""),
      dueDate: String(row.due_date ?? ""),
      state: String(row.state ?? "")
    });
  }

  const stockCustomer = await ensureStockCustomer(supabase, customersByName);

  const summary = {
    customersCreated: 0,
    customersUpdated: 0,
    contactsCreated: 0,
    machinesCreated: 0,
    machinesUpdated: 0,
    inspectionsCreated: 0,
    inspectionsSkipped: 0,
    planningCreated: 0,
    planningUpdated: 0
  };

  for (const row of parsedRows) {
    const customerKey = normalizeKey(row.isStockCustomer ? STOCK_CUSTOMER_COMPANY : row.customerName);
    let customer = customersByName.get(customerKey) ?? null;

    if (!customer) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: row.customerName,
          address_line_1: "",
          city: row.customerCity || "",
          contact_name: row.customerContact || "",
          phone: null,
          email: row.customerEmail || null
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(`Klant aanmaken mislukt voor ${row.customerName}: ${error?.message ?? "onbekende fout"}`);
      }

      customer = {
        id: String(data.id),
        companyName: String(data.company_name ?? ""),
        address: String(data.address_line_1 ?? ""),
        city: String(data.city ?? ""),
        contactName: String(data.contact_name ?? ""),
        phone: String(data.phone ?? ""),
        email: String(data.email ?? "")
      };
      customersByName.set(customerKey, customer);
      summary.customersCreated += 1;
    } else if (!row.isStockCustomer) {
      const nextCity = mergeText(customer.city, row.customerCity);
      const nextContactName = mergeText(customer.contactName, row.customerContact);
      const nextEmail = mergeText(customer.email, row.customerEmail);

      if (
        nextCity !== customer.city ||
        nextContactName !== customer.contactName ||
        nextEmail !== customer.email
      ) {
        const { error } = await supabase
          .from("customers")
          .update({
            city: nextCity || null,
            contact_name: nextContactName || null,
            email: nextEmail || null
          })
          .eq("id", customer.id);

        if (error) {
          throw new Error(`Klant bijwerken mislukt voor ${row.customerName}: ${error.message}`);
        }

        customer.city = nextCity;
        customer.contactName = nextContactName;
        customer.email = nextEmail;
        summary.customersUpdated += 1;
      }
    } else {
      customer = stockCustomer;
    }

    if (row.customerContact && !row.isStockCustomer) {
      const existingContacts = contactsByCustomerId.get(customer.id) ?? [];
      const hasContact = existingContacts.some(
        (contact) => normalizeKey(contact.name) === normalizeKey(row.customerContact)
      );

      if (!hasContact) {
        const contactInsert = {
          customer_id: customer.id,
          name: row.customerContact,
          phone: null,
          email: row.customerEmail || null,
          is_primary: existingContacts.length === 0
        };

        if (supportsContactDepartment) {
          contactInsert.department = "";
        }

        const { data, error } = await supabase
          .from("customer_contacts")
          .insert(contactInsert)
          .select("id, name, is_primary")
          .single();

        if (error || !data) {
          throw new Error(`Contactpersoon aanmaken mislukt voor ${row.customerName}: ${error?.message ?? "onbekende fout"}`);
        }

        existingContacts.push({
          id: String(data.id),
          name: String(data.name ?? ""),
          isPrimary: Boolean(data.is_primary)
        });
        contactsByCustomerId.set(customer.id, existingContacts);
        summary.contactsCreated += 1;
      }
    }

    const machineNumberKey = normalizeKey(row.machine.machineNumber);
    const machineSerialKey = normalizeKey(row.machine.serialNumber);
    let machine =
      machinesByNumber.get(machineNumberKey) ??
      (machineSerialKey ? machinesBySerial.get(machineSerialKey) : null) ??
      null;

    const machinePayload = {
      customer_id: customer.id,
      machine_number: machine?.machineNumber || row.machine.machineNumber,
      machine_type: "hoogwerker",
      availability_status: "available",
      brand: mergeText(machine?.brand, row.machine.brand) || null,
      model: mergeText(machine?.model, row.machine.model) || null,
      serial_number: mergeText(machine?.serialNumber, row.machine.serialNumber) || null,
      build_year: Number(mergeText(machine?.buildYear, row.machine.buildYear) || 0) || null,
      internal_number: mergeText(machine?.internalNumber, row.machine.internalNumber) || null,
      configuration: mergeConfiguration(machine?.configuration, row.machine.configuration)
    };

    if (!machine) {
      const { data, error } = await supabase
        .from("machines")
        .insert(machinePayload)
        .select("id, customer_id, machine_number, brand, model, serial_number, build_year, internal_number, configuration")
        .single();

      if (error || !data) {
        throw new Error(`Machine aanmaken mislukt voor ${row.machine.machineNumber}: ${error?.message ?? "onbekende fout"}`);
      }

      machine = {
        id: String(data.id),
        customerId: String(data.customer_id),
        machineNumber: String(data.machine_number ?? ""),
        brand: String(data.brand ?? ""),
        model: String(data.model ?? ""),
        serialNumber: String(data.serial_number ?? ""),
        buildYear: String(data.build_year ?? ""),
        internalNumber: String(data.internal_number ?? ""),
        configuration: data.configuration ?? {}
      };

      machinesByNumber.set(normalizeKey(machine.machineNumber), machine);
      if (normalizeKey(machine.serialNumber)) {
        machinesBySerial.set(normalizeKey(machine.serialNumber), machine);
      }
      summary.machinesCreated += 1;
    } else {
      const { data, error } = await supabase
        .from("machines")
        .update(machinePayload)
        .eq("id", machine.id)
        .select("id, customer_id, machine_number, brand, model, serial_number, build_year, internal_number, configuration")
        .single();

      if (error || !data) {
        throw new Error(`Machine bijwerken mislukt voor ${row.machine.machineNumber}: ${error?.message ?? "onbekende fout"}`);
      }

      machine = {
        id: String(data.id),
        customerId: String(data.customer_id),
        machineNumber: String(data.machine_number ?? ""),
        brand: String(data.brand ?? ""),
        model: String(data.model ?? ""),
        serialNumber: String(data.serial_number ?? ""),
        buildYear: String(data.build_year ?? ""),
        internalNumber: String(data.internal_number ?? ""),
        configuration: data.configuration ?? {}
      };

      machinesByNumber.set(normalizeKey(machine.machineNumber), machine);
      if (normalizeKey(machine.serialNumber)) {
        machinesBySerial.set(normalizeKey(machine.serialNumber), machine);
      }
      summary.machinesUpdated += 1;
    }

    const inspectionKey = `${machine.id}|${row.inspectionDate}`;
    const nextInspectionDate = addTwelveMonths(row.inspectionDate);
    const machineSnapshot = buildMachineSnapshot({
      machineNumber: machine.machineNumber,
      brand: machine.brand,
      model: machine.model,
      serialNumber: machine.serialNumber,
      buildYear: machine.buildYear,
      internalNumber: machine.internalNumber,
      configuration: mergeConfiguration(machine.configuration, row.machine.snapshotConfiguration)
    });

    let inspectionId = inspectionByKey.get(inspectionKey) ?? "";

    if (inspectionId) {
      summary.inspectionsSkipped += 1;
    } else {
      const { data: inspectionNumber, error: inspectionNumberError } = await supabase.rpc(
        "next_inspection_number",
        { target_date: row.inspectionDate }
      );

      if (inspectionNumberError || inspectionNumber == null) {
        throw new Error(
          `Keurnummer genereren mislukt voor ${row.customerName} / ${row.machine.machineNumber}: ${inspectionNumberError?.message ?? "onbekende fout"}`
        );
      }

      const inspectionPayload = {
        inspection_number: Number(inspectionNumber),
        customer_id: customer.id,
        machine_id: machine.id,
        machine_type: "hoogwerker",
        inspection_date: row.inspectionDate,
        next_inspection_date: nextInspectionDate,
        status: row.status,
        send_pdf_to_customer: false,
        checklist: row.checklist,
        customer_snapshot: buildCustomerSnapshot({
          companyName: customer.companyName,
          address: customer.address,
          contactName: row.customerContact || customer.contactName,
          phone: customer.phone,
          email: row.customerEmail || customer.email
        }),
        machine_snapshot: machineSnapshot,
        findings: row.findings,
        recommendations: row.recommendations,
        conclusion: row.conclusion
      };

      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .insert(inspectionPayload)
        .select("id")
        .single();

      if (inspectionError || !inspectionData) {
        throw new Error(
          `Keuring importeren mislukt voor ${row.customerName} / ${row.machine.machineNumber}: ${inspectionError?.message ?? "onbekende fout"}`
        );
      }

      inspectionId = String(inspectionData.id);
      inspectionByKey.set(inspectionKey, inspectionId);
      summary.inspectionsCreated += 1;
    }

    const planningResult = await syncPlanningItem(supabase, planningByMachineId, {
      inspectionId,
      customerId: customer.id,
      machineId: machine.id,
      dueDate: nextInspectionDate
    });

    if (planningResult === "created") {
      summary.planningCreated += 1;
    } else {
      summary.planningUpdated += 1;
    }
  }

  console.log("Import afgerond.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
