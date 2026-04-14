import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STOCK_CUSTOMER_COMPANY = "Heftrucks.frl";
const STOCK_CUSTOMER_EMAIL = "info@heftrucks.frl";
const STOCK_CUSTOMER_PHONE = "0653842843";

function parseArgs(argv) {
  const args = { source: "", type: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source") {
      args.source = argv[index + 1] ?? "";
      index += 1;
    } else if (argv[index] === "--type") {
      args.type = argv[index + 1] ?? "";
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
  const { error } = await supabase.from(table).select(column).limit(1);

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function planningStateForDueDate(dueDate) {
  return dueDate < todayIso() ? "overdue" : "scheduled";
}

function extractYear(value) {
  const match = clean(value).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function normalizeChecklistValue(value, allowMatig = false) {
  const normalized = normalizeKey(value);
  if (!normalized) return "nvt";
  if (normalized.startsWith("goed") || normalized.includes("voldoende")) return "goed";
  if (allowMatig && normalized.includes("matig")) return "matig";
  if (
    normalized.includes("slecht") ||
    normalized.includes("afkeur") ||
    normalized.includes("onvoldoende") ||
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

function joinValues(values, separator = " / ") {
  return values.map((value) => clean(value)).filter(Boolean).join(separator);
}

function preferIncoming(existingValue, nextValue) {
  return clean(nextValue) || clean(existingValue);
}

function preferExisting(existingValue, nextValue) {
  return clean(existingValue) || clean(nextValue);
}

function mergeConfiguration(existingConfig, incomingConfig) {
  return compactConfig({
    ...(existingConfig ?? {}),
    ...Object.fromEntries(
      Object.entries(incomingConfig ?? {}).filter(([, value]) => clean(value))
    )
  });
}

function looksLikeAddress(value) {
  const line = normalizeWhitespace(value);
  return /\d/.test(line) || /,\s*\d{4}\s?[A-Za-z]{2}\b/.test(line) || line.includes(",");
}

function extractCityFromAddress(value) {
  const line = normalizeWhitespace(value);
  const postalMatch = line.match(/\b\d{4}\s?[A-Za-z]{2}\s+(.+)$/);
  if (postalMatch) {
    return postalMatch[1].trim();
  }
  const commaParts = line.split(",");
  if (commaParts.length > 1) {
    return commaParts.at(-1)?.trim() ?? "";
  }
  return "";
}

function meaningfulContactName(value) {
  const normalized = normalizeKey(value);
  if (!normalized || ["contact", "-", "nvt", "n.v.t.", "geen"].includes(normalized)) {
    return "";
  }
  return normalizeWhitespace(value);
}

function parseCustomerBlock(value) {
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

function isStockCustomer(rowCustomer) {
  const company = normalizeKey(rowCustomer.companyName);
  const email = normalizeKey(rowCustomer.email);
  return (
    (company.includes("heftrucks") && company.includes("friesland")) ||
    email.endsWith("@heftrucks.frl")
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

function buildFallbackMachineNumber(values) {
  const parts = values.map((value) => clean(value)).filter(Boolean);
  return parts.join(" - ");
}

const importConfigs = {};

function buildChecklist(config, row) {
  return Object.fromEntries(
    Object.entries(config.checklistMap).map(([sourceKey, targetKey]) => [
      targetKey,
      normalizeChecklistValue(row[sourceKey], config.allowMatig)
    ])
  );
}

importConfigs.stellingmateriaal = {
  type: "stellingmateriaal",
  allowMatig: true,
  checklistMap: {
    "Gebouwvloer - 1 Scheuren": "scheuren",
    "Gebouwvloer - 2 Verzakkingen": "verzakkingen",
    "Beveiliging - 1 Doorval-beveiliging": "doorval_beveiliging",
    "Beveiliging - 2 Diepteliggers bij pallets met afwijkende maten en kwaliteiten": "diepteliggers",
    "Aanrijbeschermers - 1 aanwezigheid": "aanwezigheid_1",
    "Aanrijbeschermers - 2 aanwezigheid": "aanwezigheid_2",
    "Beschadigingen - 1 aanrij-beschadigingen": "aanrij_beschadigingen",
    "Beschadigingen - 2 Corrosie": "corrosie",
    "Beschadigingen - 3 Vervormingen": "vervormingen",
    "Beschadigingen - 4 Bewerkingen als boren, lassen e.d.": "boren_lassen",
    "Gebruik van de stelling - 1 Max doorbuigingen van 1/200 x L": "max_doorbuiging",
    "Gebruik van de stelling - 2 Conform opgegeven belastingen": "conform_belastingen",
    "Gebruik van de stelling - 3 Actuele draagvermogenborden": "actuele_draagvermogenborden",
    "Montage - 1 Inhaken liggers": "inhaken_liggers",
    "Montage - 2 Aanwezigheid borging": "aanwezigheid_borging",
    "Montage - 3 Loodrechte stand stellingen": "loodrechte_stand",
    "Montage - 4 Aanwezigheid schoorverbanden": "aanwezigheid_schoorverbanden",
    "Montage - 5 Wijzigingen vakhoogtes en liggerniveaus": "wijzigingen_vakhoogtes",
    "Montage - 7 Juiste montage koppelstukken": "juiste_montage_koppelstukken",
    "Montage - 6 Ontbrekende delen t.o.v oorspronkelijke configuratie": "ontbrekende_delen",
    "Montage - 8 Verschuivingen": "verschuivingen",
    "Montage - 9 Aanwezigheid verankering": "aanwezigheid_verankering",
    "Montage - 10 Wijziging rijlengte": "wijziging_rijlengte",
    "Montage - 11 Wijzigingen aantal etages": "wijzigingen_aantal_etages",
    "Montage - 12 Vulplaten staanders": "vulplaten_staanders",
    "Stellingvloer/entresol - 1 Gebruik conform opgegeven belasting": "gebruik_belasting",
    "Stellingvloer/entresol - 2 Conditie staalconstructie": "conditie_staalconstructie",
    "Stellingvloer/entresol - 3 Conditie railing": "conditie_railing",
    "Stellingvloer/entresol - 4 Conditie dekvloeren": "conditie_dekvloeren",
    "Stellingvloer/entresol - 5 Conditie trappen": "conditie_trappen",
    "Stellingvloer/entresol - 6 Conditie palletopzetplaatsen": "conditie_palletopzetplaatsen",
    "Verrijdbare stellingen - 1 Beveiligingen": "beveiligingen",
    "Verrijdbare stellingen - 2 Railconditie": "railconditie",
    "Verrijdbare stellingen - 3 Onderwagen en aandrijving": "onderwagen_aandrijving",
    "Verrijdbare stellingen - 4 Besturing": "besturing"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const rackingType = joinValues([
      row["Soort stelling"],
      row["Soort stelling__2"],
      row["Soort stelling__3"]
    ]);
    const dossierNumber = clean(row["Dosiernummer"]);
    const zone = clean(row["Gebied"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber:
          dossierNumber || buildFallbackMachineNumber([customer.companyName, zone, rackingType, inspectionDate]),
        brand: clean(row["Merk"]) || "Stelling",
        model: rackingType || zone || "Stellingmateriaal",
        serialNumber: "",
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: dossierNumber,
        configuration: compactConfig({
          dossier_number: dossierNumber,
          zone,
          racking_type: rackingType
        }),
        snapshotConfiguration: compactConfig({
          dossier_number: dossierNumber,
          zone,
          racking_type: rackingType,
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

importConfigs.palletwagen_stapelaar = {
  type: "palletwagen_stapelaar",
  allowMatig: false,
  checklistMap: {
    "1) Bevestigingen": "bevestigingen",
    "2) Beplating, afscherming, beschermroosters & ruiten": "beplating_afscherming",
    "3)Beschermkooi/Bestuurdersbescherm.": "beschermkooi",
    "4) Lasverbindingen": "lasverbindingen",
    "5) Zwenkwielen / steunblokken": "zwenkwielen_steunblokken",
    Totaal: "totaal",
    "1) Ophanging": "ophanging",
    "2) Velgen": "velgen",
    "3 Bandenspanning & - slijtage": "bandenspanning_slijtage",
    "4) Wielbouten,- moeren, en assen": "wielbouten_moeren_assen",
    "5) Lekkages ( remsysteem)": "lekkages_remsysteem",
    "6) Remvoering, - trommels en -schijven": "remvoering",
    "7) Ankerplaten / remklauwen": "ankerplaten_remklauwen",
    "8 Werking parkeerrem": "werking_parkeerrem",
    "9) Algehele remwerking": "algehele_remwerking",
    "1) Overbrengmechanisme": "overbrengmechanisme",
    "2) Werking stuurbekrachtiging": "werking_stuurbekrachtiging",
    "1) Motor/ aandrijfunit V/E": "motor_aandrijfunit",
    "2) Motorophanging": "motorophanging",
    "3) Bedrading": "bedrading",
    "4) Werking aandrijfmotor (E/V)": "werking_aandrijfmotor",
    "5) Montage brandstoftank / tractiebatterij": "montage_brandstoftank_tractiebatterij",
    "6) Schakelapparatuur": "schakelapparatuur",
    "7) Bevestiging / lekkage transmissie": "bevestiging_transmissie",
    "1) Vervormingen": "vervormingen",
    "2) Borgingen": "borgingen",
    "3) Looprollen": "looprollen",
    "4) Functioneren hefmast": "functioneren_hefmast",
    "5) Hefmast ophanging": "hefmast_ophanging",
    "6) Meetcontrole hefkettingen": "meetcontrole_hefkettingen",
    "7) Hefmastverbindingen / -inrichtingen": "hefmastverbindingen",
    "8) Lekkage / Hydraulische cilinders": "lekkage_hydraulische_cilinders",
    "9) Hydraulisch oliepeil": "hydraulisch_oliepeil",
    "10) Overdruk afstelling": "overdruk_afstelling",
    "11) Werking pomp/pompmotor": "werking_pomp",
    "12) Praktische werking hefgedeelte": "praktische_werking_hefgedeelte",
    "13) Hydraulische slangen, lekkage, verbindingen": "hydraulische_slangen",
    "18) Totale werking hefgedeelte": "totale_werking_hefgedeelte",
    "1) Beschermingen/instructies": "beschermingen_instructies",
    "2) Identificatieplaten, opschriften, documentatie": "identificatieplaten_opschriften",
    "3) Op- en afstap & handgrepen": "op_afstap_handgrepen",
    "4) Bedieningsorganen": "bedieningsorganen",
    "5) Veiligheid signalering": "veiligheid_signalering",
    "1) Elektrische installatie (algemeen)": "elektrische_installatie_algemeen",
    "2) Veiligheidsschakelingen": "veiligheidsschakelingen",
    "3) Keursticker van de tractiebatterij": "keursticker_tractiebatterij",
    "4) Keursticker van de lader": "keursticker_lader",
    "5) Resultaat NEN 3140": "resultaat_nen3140",
    "9) Totale werking/proefrit": "totale_werking_proefrit"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    const serialNumber = clean(row["Serienummer"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber: serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
        brand: clean(row["Merk"]),
        model: clean(row["Type"]),
        serialNumber,
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: "",
        configuration: compactConfig({
          inspector: clean(row["Keurmeester:"])
        }),
        snapshotConfiguration: compactConfig({
          inspector: clean(row["Keurmeester:"]),
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

importConfigs.heftruck_reachtruck = {
  type: "heftruck_reachtruck",
  allowMatig: false,
  checklistMap: {
    "1) Bevestigingen": "bevestigingen",
    "2) Aanhangkoppeling": "aanhangkoppeling",
    "3) Beschermroosters": "beschermroosters",
    "4) Beschermkap": "beschermkap",
    "5) Beplating en afscherming": "beplating_afscherming",
    "6) Lasverbindingen": "lasverbindingen",
    Totaal: "totaal_constructie",
    "1) Velgen": "velgen",
    "2) Bandenspanning en slijtage": "bandenspanning_slijtage",
    "3 Wielboutmoeren en assen": "wielboutmoeren_assen",
    "4) Lekkage": "lekkage",
    "5) Werking parkeerrem": "werking_parkeerrem",
    "6) Remvloeistof": "remvloeistof",
    "7) Remvoering,-trommels , -schijven": "remvoering_trommels_schijven",
    "8 Ankerplaten": "ankerplaten",
    "9) Algehele remwerking": "algehele_remwerking",
    "1) Stuurwiel": "stuurwiel",
    "2) Stuurboom/disselboom": "stuurboom_disselboom",
    "3) Lekkage stuursysteem": "lekkage_stuursysteem",
    "4) Stuuras": "stuuras",
    "5) Stuurkogels": "stuurkogels",
    "6) Fusee pennen": "fusee_pennen",
    "7) Stuurketting": "stuurketting",
    "8) Overbrengingsmechanisme": "overbrengingsmechanisme",
    "9) Werking stuurbekrachtiging": "werking_stuurbekrachtiging",
    "1) Aandrijfunit V/E": "aandrijfunit",
    "2) Motorophanging": "motorophanging",
    "3) Bedrading": "bedrading",
    "4) Schakelapparatuur": "schakelapparatuur",
    "5) Werking aandrijfmotor E/V": "werking_aandrijfmotor",
    "6) Uitlaatgassysteem": "uitlaatgassysteem",
    "7) Montagebrandstoftank/tractiebatterij": "montage_brandstoftank_tractiebatterij",
    "8) Bevestiging / lekkage transmissie": "bevestiging_transmissie",
    "1) Vervormingen": "vervormingen",
    "2) Borgingen": "borgingen",
    "3) Lastbeschermrek": "lastbeschermrek",
    "4) Vorkophanging": "vorkophanging",
    "5) Meetcontrole vorken": "meetcontrole_vorken",
    "6) Meetcontrole hefkettingen": "meetcontrole_hefkettingen",
    "7) Kettingrollen": "kettingrollen",
    "8) Looprollen": "looprollen",
    "9) Voorzetstukken": "voorzetstukken",
    "10) Functionering hefmast": "functionering_hefmast",
    "11) Hefmastophanging": "hefmastophanging",
    "12) Hefmastverbindingen": "hefmastverbindingen",
    "13) Lekkage cilinders": "lekkage_cilinders",
    "14) Hydr. slangen/lekkage/verbindingen": "hydr_slangen_lekkage",
    "15) Hydr. oliepeil": "hydr_oliepeil",
    "16) Overdrukafstelling (sper)ventiel": "overdrukafstelling_sperventiel",
    "17) Werking pomp/pompmotor": "werking_pomp",
    "18) Totale werking hefgedeelte": "totale_werking_hefgedeelte",
    "1) Beschermingen/instructies": "beschermingen_instructies",
    "2) Op/afstap/handgrepen": "op_afstap_handgrepen",
    "3) Cabine en toebehoren": "cabine_toebehoren",
    "4) Bedieningsorganen": "bedieningsorganen",
    "5) Stoelbevestiging en - verstelling": "stoelbevestiging_verstelling",
    "6) Veiligheidsgordel": "veiligheidsgordel",
    "7) Veiligheidsschakelingen": "veiligheidsschakelingen",
    "8) Elektrische installatie": "elektrische_installatie",
    "9) Totale werking/proefrit": "totale_werking_proefrit",
    "10) Identificatieplaten": "identificatieplaten",
    "11) Sticker tractiebatterij": "sticker_tractiebatterij"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    const serialNumber = clean(row["Serienummer"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber: serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
        brand: clean(row["Merk"]),
        model: clean(row["Type"]),
        serialNumber,
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: "",
        configuration: compactConfig({
          inspector: clean(row["Keurmeester:"])
        }),
        snapshotConfiguration: compactConfig({
          inspector: clean(row["Keurmeester:"]),
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

importConfigs.verreiker = {
  type: "verreiker",
  allowMatig: false,
  checklistMap: {
    "1) Documenten": "documenten",
    "2) Veiligheids- + bedieningsstickers": "veiligheids_bedieningsstickers",
    "1) Op en afstapbeveilingen": "op_afstapbeveiligingen",
    "2) Startbeveiliging/noodstopschakelaar": "startbeveiliging_noodstop",
    "3) Veiligheidsgordel": "veiligheidsgordel",
    "4) Spiegels, zonneklep": "spiegels_zonneklep",
    "5) Achteruitrijalarm/zwaailamp/ overlastsignalering": "achteruitrijalarm_zwaailamp",
    "6) Vergrendelingen": "vergrendelingen",
    "7) Brandbeveiliging": "brandbeveiliging",
    "1) Scheuren en vervormingen": "scheuren_vervormingen",
    "2) Banden en wielen": "banden_wielen",
    "3) Assen en steunpoten": "assen_steunpoten",
    "4) Trekhaak/stopcont. aanhangwagen": "trekhaak_stopcontact",
    "5) Leveling": "leveling",
    "6) Draaikrans": "draaikrans",
    "1) Werking remmen": "werking_remmen",
    "2) Remaccumulator": "remaccumulator",
    "3) Luchtdrukremsysteem": "luchtdrukremsysteem",
    "4) Stuurcilinder": "stuurcilinder",
    "5) Stuursysteem": "stuursysteem",
    "1) Werking": "hydrauliek_werking",
    "2) Slangen/cilinders/bevestigingen": "slangen_cilinders_bevestigingen",
    "3) Afstellingen max werkdruk": "afstellingen_max_werkdruk",
    "4) Hydrauliek oliepeil": "hydrauliek_oliepeil",
    "1) Vervormingen": "vervormingen",
    "2) Lastbeschermrek": "lastbeschermrek",
    "3) Vorken": "vorken",
    "4) Looprollen/glijblokken/kettingen": "looprollen_glijblokken_kettingen",
    "5) Voorzetapparatuur": "voorzetapparatuur",
    "6) Functionering telescoop": "functionering_telescoop",
    "7) Telescoopophanging": "telescoopophanging",
    "8) Lastmomentprogramma's": "lastmomentprogrammas",
    "9) Werking lastmomentbeveiliging": "werking_lastmomentbeveiliging",
    "10- Wissel vorkenbord": "wissel_vorkenbord",
    "11) Werking compensatiecircuit": "werking_compensatiecircuit",
    "1) Motorophanging": "motorophanging",
    "2) Uitlaat": "uitlaat",
    "3) Roetfilter": "roetfilter",
    "4) Brandstofsysteem": "brandstofsysteem",
    "5) Kabels": "kabels",
    "6) V-snaren": "v_snaren",
    "7) Afdichtingen": "afdichtingen",
    "8) Aandrijving": "aandrijving",
    "1) Bevestiging van de cabine": "bevestiging_cabine",
    "2) Op/afstap handgrepen": "op_afstap_handgrepen",
    "3) Overdruk in cabine": "overdruk_cabine",
    "4) Ruiten/ruitenwissers/sproeiers": "ruiten_wissers_sproeiers",
    "5) Bediening en stoel": "bediening_stoel",
    "6) Losliggende delen": "losliggende_delen",
    "7) Waterpas": "waterpas",
    "8) Last/vluchtdiagrammen": "last_vluchtdiagrammen",
    "9) Kachel": "kachel",
    "1) Verlichting en bekabeling": "verlichting_bekabeling",
    "2) Accubevestigingen": "accubevestigingen",
    "3) Radiograaf": "radiograaf"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    const serialNumber = clean(row["Serienummer"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber: serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
        brand: clean(row["Merk"]),
        model: clean(row["Type"]),
        serialNumber,
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: "",
        configuration: {},
        snapshotConfiguration: compactConfig({
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

importConfigs.shovel = {
  type: "shovel",
  allowMatig: false,
  checklistMap: {
    Documenten: "documenten",
    "veiligheids + bedieningslabel": "veiligheidslabel",
    Radio: "veiligheidsvoorzieningen",
    "op en afstapbeveiliging": "op_afstapbeveiliging",
    startbeveiliging: "startbeveiliging",
    "knikbeveiliging tbv transport": "knikbeveiliging",
    veiligheidsriem: "veiligheidsriem",
    "spiegels, zonneklep": "spiegels_zonneklep",
    "achteruitrij-alarm": "achteruitrij_alarm",
    "blokkering bedieningshandles": "blokkering_bedieningshandles",
    "scheuren en vervormingen": "scheuren_vervormingen",
    knikpunt: "knikpunt",
    "banden/wielen": "banden_wielen",
    trekhaak: "trekhaak",
    asophanging: "asophanging",
    werking: "werking",
    slijtage: "slijtage",
    "werking/vulling accumulator": "werking_vulling_accumulator",
    noodstuursysteem: "noodstuursysteem",
    parkeerrem: "parkeerrem",
    "overmatige speling": "overmatige_speling",
    luchtdruksysteem: "luchtdruksysteem",
    "hydraulisch oliepeil": "hydraulisch_oliepeil",
    werking__2: "hydraulisch_werking",
    "Slangen / verbindingen / bevestigingen": "hydraulische_slangen",
    overdrukafstelling: "overdrukafstelling",
    scharnierpennen: "scharnierpennen",
    "bak- en snelwisselsysteem": "bak_snelwisselsysteem",
    motorophanging: "motorophanging",
    uitlaat: "uitlaat",
    brandstofsysteem: "brandstofsysteem",
    kabels: "kabels",
    "V-snaren": "v_snaren",
    afdichtingen: "afdichtingen",
    "afdichting van de cabine": "afdichting_cabine",
    "overdruk in de cabine": "overdruk_cabine",
    overdruksignalering: "overdruksignalering",
    "werking van filters": "werking_filters",
    stickers: "stickers",
    "ruitenwissers / sproeiers": "ruitenwissers_sproeiers",
    bedieningshandles: "bedieningshandles",
    "losliggende delen": "losliggende_delen",
    "f) Slangen": "slangen",
    "electrisch systeem": "electrisch_systeem"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    const serialNumber = clean(row["Serienummer"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber: serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
        brand: clean(row["Merk"]),
        model: clean(row["Type"]),
        serialNumber,
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: "",
        configuration: {},
        snapshotConfiguration: compactConfig({
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

importConfigs.graafmachine = {
  type: "graafmachine",
  allowMatig: false,
  checklistMap: {
    Documenten: "documenten",
    "veiligheids + bedieningslabel": "veiligheidslabel",
    "veiligheidshandel in servo": "veiligheidshandel_servo",
    "op en afstapbeveiligingen": "op_afstapbeveiligingen",
    "startsper in rijstand": "startsper_rijstand",
    "spiegels, zonneklep": "spiegels_zonneklep",
    "achteruitrij-alarm": "achteruitrij_alarm",
    vergrendelingen: "vergrendelingen",
    "banden / wielen": "banden_wielen",
    tussenringen: "tussenringen",
    stabilisators: "stabilisators",
    schuifblad: "schuifblad",
    aandrijfunit: "aandrijfunit",
    stuurcilinder: "stuurcilinder",
    trekhaak: "trekhaak",
    draaikrans: "draaikrans",
    rupsplaten: "rupsplaten",
    sprocket: "sprocket",
    spancilinder: "spancilinder",
    plaatwerk: "plaatwerk",
    frame: "frame",
    "centrale doorvoer": "centrale_doorvoer",
    contragewicht: "contragewicht",
    sluitingen: "sluitingen",
    brandstofvoorziening: "brandstofvoorziening",
    werking: "hydrauliek_werking",
    "Slangen / verbindingen / bevestigingen": "hydrauliek_slangen_verbindingen",
    overdrukafstelling: "overdrukafstelling",
    "hydraulisch oliepeil": "hydraulisch_oliepeil",
    "lekkage slangen/leidingen/cilinders": "lekkage_sl_cil",
    ophanging: "ophanging",
    leidingwerk: "leidingwerk",
    plaatwerk__2: "giek_plaatwerk",
    opschriften: "opschriften",
    "borging pennen": "borging_pennen",
    snelwisselsysteem: "snelwisselsysteem",
    motorophanging: "motorophanging",
    uitlaat: "uitlaat",
    brandstofsysteem: "brandstofsysteem",
    kabels: "kabels",
    "V-snaren": "v_snaren",
    afdichtingen: "afdichtingen",
    "afdichting van de cabine": "afdichting_cabine",
    "overdruk in de cabine": "overdruk_cabine",
    overdruksignalering: "overdruksignalering",
    "werking van filters": "werking_filters",
    stickers: "stickers",
    "ruitenwissers / sproeiers": "ruitenwissers_sproeiers",
    bedieningshandles: "bedieningshandles",
    "losliggende delen": "losliggende_delen",
    "f) Slangen": "slangen",
    "electrisch systeem": "electrisch_systeem",
    remmen: "remmen",
    luchtdruksysteem: "luchtdruksysteem"
  },
  mapRow(row) {
    const customer = parseCustomerBlock(row["Bedrijfsgegevens gebruiker"]);
    const inspectionDate = normalizeDate(row["Keuringsdatum"]);
    const serialNumber = clean(row["Serienummer"]);
    return {
      customer: {
        ...customer,
        email: clean(row["E-mailadres gebruiker"])
      },
      inspectionDate,
      findings: clean(row["Bevindingen"]),
      recommendations: clean(row["Aanbevelingen"]),
      conclusion: clean(row["Conclusie"]),
      status: deriveStatus(row["Conclusie"]),
      machine: {
        machineNumber: serialNumber || buildFallbackMachineNumber([customer.companyName, row["Merk"], row["Type"], inspectionDate]),
        brand: clean(row["Merk"]),
        model: clean(row["Type"]),
        serialNumber,
        buildYear: extractYear(row["Bouwjaar"]),
        internalNumber: "",
        configuration: {},
        snapshotConfiguration: compactConfig({
          sticker_number: clean(row["Stickernummer"])
        })
      },
      checklist: buildChecklist(this, row)
    };
  }
};

function isMeaningfulMappedRow(row) {
  return Boolean(
    clean(row.inspectionDate) &&
      clean(row.conclusion) &&
      (
        clean(row.customer.companyName) ||
        clean(row.machine.machineNumber) ||
        clean(row.machine.brand) ||
        clean(row.machine.model) ||
        clean(row.machine.serialNumber) ||
        clean(row.machine.internalNumber)
      )
  );
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

function pushMapValue(map, key, value) {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(value);
  map.set(key, current);
}

function replaceMachinePlanningCache(cache, machineId, item) {
  cache.set(machineId, item ? [item] : []);
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
  const { source, type } = parseArgs(process.argv.slice(2));

  if (!source || !type) {
    throw new Error("Gebruik --source en --type, bijvoorbeeld --type heftruck_reachtruck.");
  }

  const config = importConfigs[type];
  if (!config) {
    throw new Error(`Onbekend type '${type}'.`);
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
    parseCsv(raw).map((row) => config.mapRow(row)).filter(isMeaningfulMappedRow)
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
      availabilityStatus: String(row.availability_status ?? "available"),
      configuration: row.configuration ?? {}
    };
    const machineNumberKey = normalizeKey(machine.machineNumber);
    const serialKey = normalizeKey(machine.serialNumber);
    if (machineNumberKey) machinesByNumber.set(machineNumberKey, machine);
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
    rowsParsed: parsedRows.length,
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
    const stockCustomerRow = isStockCustomer(row.customer);
    const customerKey = normalizeKey(
      stockCustomerRow ? STOCK_CUSTOMER_COMPANY : row.customer.companyName
    );
    let customer = customersByName.get(customerKey) ?? null;

    if (!customer) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: row.customer.companyName,
          address_line_1: row.customer.address || "",
          city: row.customer.city || "",
          contact_name: row.customer.contactName || "",
          phone: null,
          email: row.customer.email || null
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(`Klant aanmaken mislukt voor ${row.customer.companyName}: ${error?.message ?? "onbekende fout"}`);
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
    } else if (!stockCustomerRow) {
      const nextAddress = preferIncoming(customer.address, row.customer.address);
      const nextCity = preferIncoming(customer.city, row.customer.city);
      const nextContactName = preferExisting(customer.contactName, row.customer.contactName);
      const nextEmail = preferExisting(customer.email, row.customer.email);

      if (
        nextAddress !== customer.address ||
        nextCity !== customer.city ||
        nextContactName !== customer.contactName ||
        nextEmail !== customer.email
      ) {
        const { error } = await supabase
          .from("customers")
          .update({
            address_line_1: nextAddress || null,
            city: nextCity || null,
            contact_name: nextContactName || null,
            email: nextEmail || null
          })
          .eq("id", customer.id);

        if (error) {
          throw new Error(`Klant bijwerken mislukt voor ${row.customer.companyName}: ${error.message}`);
        }

        customer.address = nextAddress;
        customer.city = nextCity;
        customer.contactName = nextContactName;
        customer.email = nextEmail;
        summary.customersUpdated += 1;
      }
    } else {
      customer = stockCustomer;
    }

    if (row.customer.contactName && !stockCustomerRow) {
      const existingContacts = contactsByCustomerId.get(customer.id) ?? [];
      const hasContact = existingContacts.some(
        (contact) => normalizeKey(contact.name) === normalizeKey(row.customer.contactName)
      );

      if (!hasContact) {
        const contactInsert = {
          customer_id: customer.id,
          name: row.customer.contactName,
          phone: null,
          email: row.customer.email || null,
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
          throw new Error(`Contactpersoon aanmaken mislukt voor ${row.customer.companyName}: ${error?.message ?? "onbekende fout"}`);
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
      machine_type: config.type,
      availability_status: machine?.availabilityStatus || "available",
      brand: preferIncoming(machine?.brand, row.machine.brand) || null,
      model: preferIncoming(machine?.model, row.machine.model) || null,
      serial_number: preferIncoming(machine?.serialNumber, row.machine.serialNumber) || null,
      build_year: Number(preferIncoming(machine?.buildYear, row.machine.buildYear) || 0) || null,
      internal_number: preferIncoming(machine?.internalNumber, row.machine.internalNumber) || null,
      configuration: mergeConfiguration(machine?.configuration, row.machine.configuration)
    };

    if (!machine) {
      const { data, error } = await supabase
        .from("machines")
        .insert(machinePayload)
        .select("id, customer_id, machine_number, brand, model, serial_number, build_year, internal_number, availability_status, configuration")
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
        availabilityStatus: String(data.availability_status ?? "available"),
        configuration: data.configuration ?? {}
      };
      summary.machinesCreated += 1;
    } else {
      const { data, error } = await supabase
        .from("machines")
        .update(machinePayload)
        .eq("id", machine.id)
        .select("id, customer_id, machine_number, brand, model, serial_number, build_year, internal_number, availability_status, configuration")
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
        availabilityStatus: String(data.availability_status ?? "available"),
        configuration: data.configuration ?? {}
      };
      summary.machinesUpdated += 1;
    }

    machinesByNumber.set(normalizeKey(machine.machineNumber), machine);
    if (normalizeKey(machine.serialNumber)) {
      machinesBySerial.set(normalizeKey(machine.serialNumber), machine);
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
          `Keurnummer genereren mislukt voor ${row.customer.companyName} / ${row.machine.machineNumber}: ${inspectionNumberError?.message ?? "onbekende fout"}`
        );
      }

      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .insert({
          inspection_number: Number(inspectionNumber),
          customer_id: customer.id,
          machine_id: machine.id,
          machine_type: config.type,
          inspection_date: row.inspectionDate,
          next_inspection_date: nextInspectionDate,
          status: row.status,
          send_pdf_to_customer: false,
          checklist: row.checklist,
          customer_snapshot: buildCustomerSnapshot({
            companyName: customer.companyName,
            address: customer.address,
            contactName: row.customer.contactName || customer.contactName,
            phone: customer.phone,
            email: row.customer.email || customer.email
          }),
          machine_snapshot: machineSnapshot,
          findings: row.findings,
          recommendations: row.recommendations,
          conclusion: row.conclusion
        })
        .select("id")
        .single();

      if (inspectionError || !inspectionData) {
        throw new Error(
          `Keuring importeren mislukt voor ${row.customer.companyName} / ${row.machine.machineNumber}: ${inspectionError?.message ?? "onbekende fout"}`
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
