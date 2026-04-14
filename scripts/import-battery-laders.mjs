import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  const { data, error } = await supabase
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

function firstFilled(row, keys) {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) {
      return value;
    }
  }
  return "";
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

function extractYear(value) {
  const match = clean(value).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function normalizeChecklistValue(value) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return "nvt";
  if (normalized.startsWith("goed")) return "goed";
  if (normalized.includes("slecht") || normalized.includes("afkeur") || normalized.includes("matig")) {
    return "slecht";
  }
  if (normalized.includes("nvt") || normalized.includes("n.v.t")) return "nvt";
  return "nvt";
}

function deriveStatus(conclusion) {
  const normalized = clean(conclusion).toLowerCase();
  if (normalized.includes("afgekeurd")) return "rejected";
  if (normalized.includes("behandeling")) return "draft";
  return "approved";
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

function compactConfig(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => clean(value))
  );
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeSerialKey(value) {
  return clean(value)
    .replace(/\s+/g, "")
    .toLowerCase();
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

const checklistMap = {
  "Staat container": "staat_container",
  Hijsogen: "hijsogen",
  Identificatieplaatje: "identificatieplaatje",
  "Staat batterij": "staat_batterij",
  Eindkabels: "eindkabels",
  Celverbindingen: "celverbindingen",
  Stekkers: "stekkers",
  Poolbouten: "poolbouten",
  Vuldoppen: "vuldoppen",
  Celdeksels: "celdeksels",
  "Primaire kabel": "primaire_kabel",
  "Primaire stekker": "primaire_stekker",
  "Primaire kabel trekontlasting": "primaire_kabel_trekontlasting",
  "Secundaire kabel (laadkabel)": "secundaire_kabel",
  "Secundaire kabel stekker": "secundaire_kabel_stekker",
  "Secundaire kabel trekontlasting": "secundaire_kabel_trekontlasting",
  "Secundaire kabel stopknop (aan/uit schakelaar)": "secundaire_kabel_stopknop",
  "Secundaire kabel stopknop ( aan/uit-schakelaar)": "secundaire_kabel_stopknop",
  "Veiligheid indicatielampjes": "veiligheid_indicatielampjes",
  "Veiligheid opschriften": "veiligheid_opschriften",
  "Veiligheid aarde": "veiligheid_aarde",
  "Veiligheid behuizing lader": "veiligheid_behuizing_lader",
  "Veiligheid opstelling van de kast": "veiligheid_opstelling_kast",
  Bedieningsvoorschriften: "bedieningsvoorschriften"
};

function buildChecklist(row) {
  return Object.fromEntries(
    Object.entries(checklistMap).map(([sourceKey, targetKey]) => [
      targetKey,
      normalizeChecklistValue(row[sourceKey])
    ])
  );
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
    customerName: customer.companyName,
    customerAddress: customer.address,
    customerCity: customer.city,
    customerContact: customer.contactName,
    customerEmail: clean(row["E-mailadres gebruiker"]),
    inspectionDate: normalizeDate(row["Keuringsdatum"]),
    findings: clean(row["Bevindingen"]),
    recommendations: clean(row["Aanbevelingen"]),
    conclusion: clean(row["Conclusie"]),
    status: deriveStatus(row["Conclusie"]),
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
        charger_internal_number: chargerInternal,
        drawing_number: clean(row["Tekening nummer"]),
        charger_voltage: clean(row["Netspanning"]),
        double_insulated: firstFilled(row, ["Dubbel geïsoleerd", "Dubbel geÃ¯soleerd"]),
        source_submission_time: clean(row["Inzendingstijd"]),
        source_customer_name: customer.companyName,
        source_customer_address: customer.address,
        source_customer_city: customer.city,
        source_customer_contact: customer.contactName
      })
    },
    checklist: buildChecklist(row)
  };
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2));
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

  const supportsContactDepartment = await hasColumn(supabase, "customer_contacts", "department");

  const raw = await fs.readFile(path.resolve(source), "utf8");
  const parsedRows = parseCsv(raw).map(mapRow).filter(isMeaningfulRow);

  const [customerRows, contactRows, machineRows, inspectionRows] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("customer_contacts").select("*"),
    supabase.from("machines").select("*"),
    supabase.from("inspections").select("id, machine_id, inspection_date")
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
  const customersById = new Map(
    (customerRows.data ?? []).map((row) => [
      String(row.id),
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
  const machinesById = new Map();
  const exactVehicleMatches = new Map();
  for (const row of machineRows.data ?? []) {
    const machine = {
      id: String(row.id),
      customerId: String(row.customer_id),
      machineNumber: String(row.machine_number ?? ""),
      machineType: String(row.machine_type ?? ""),
      serialNumber: String(row.serial_number ?? ""),
      configuration: (row.configuration ?? {})
    };
    machinesByNumber.set(normalizeKey(machine.machineNumber), machine);
    machinesById.set(machine.id, machine);
    const serialKey = normalizeSerialKey(machine.serialNumber);
    if (machine.machineType !== "batterij_lader" && serialKey) {
      pushMapValue(exactVehicleMatches, serialKey, machine);
    }
  }
  const inspectionKeys = new Set(
    (inspectionRows.data ?? []).map((row) => `${String(row.machine_id)}|${String(row.inspection_date)}`)
  );

  const summary = {
    rowsParsed: parsedRows.length,
    rowsSkippedMissingCustomer: 0,
    customersCreated: 0,
    contactsCreated: 0,
    machinesCreated: 0,
    machinesUpdated: 0,
    inspectionsCreated: 0,
    inspectionsSkipped: 0,
    planningCreated: 0,
    linkedExact: 0,
    linkedPreserved: 0,
    unlinkedNoVehicleSerial: 0,
    unlinkedNoMatch: 0,
    unlinkedAmbiguous: 0
  };

  for (const row of parsedRows) {
    const machineKey = normalizeKey(row.machine.machineNumber);
    let machine = machinesByNumber.get(machineKey) ?? null;
    const matchedVehicles = row.vehicleSerialKey ? exactVehicleMatches.get(row.vehicleSerialKey) ?? [] : [];
    const exactLinkedMachine = matchedVehicles.length === 1 ? matchedVehicles[0] : null;
    const preservedLinkedMachineId =
      exactLinkedMachine?.id ||
      String(machine?.configuration?.linked_machine_id ?? "").trim();
    const preservedLinkedMachine = preservedLinkedMachineId
      ? machinesById.get(preservedLinkedMachineId) ?? null
      : null;
    const linkedMachine = exactLinkedMachine ?? preservedLinkedMachine ?? null;
    const linkedCustomerFromMachine = linkedMachine
      ? customersById.get(linkedMachine.customerId) ?? null
      : null;
    const customerKey = normalizeKey(row.customerName || linkedCustomerFromMachine?.companyName || "");
    let customer =
      (row.customerName ? customersByName.get(customerKey) : null) ??
      linkedCustomerFromMachine ??
      null;

    if (!customer && !row.customerName) {
      summary.rowsSkippedMissingCustomer += 1;
      continue;
    }

    if (!customer) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: row.customerName,
          address_line_1: row.customerAddress || "",
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
      customersById.set(customer.id, customer);
      summary.customersCreated += 1;
    } else {
      const nextAddress = customer.address || row.customerAddress;
      const nextCity = customer.city || row.customerCity;
      const nextContactName = customer.contactName || row.customerContact;
      const nextEmail = customer.email || row.customerEmail;
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
          throw new Error(`Klant bijwerken mislukt voor ${row.customerName}: ${error.message}`);
        }
        customer.address = nextAddress;
        customer.city = nextCity;
        customer.contactName = nextContactName;
        customer.email = nextEmail;
        customersById.set(customer.id, customer);
      }
    }

    if (row.customerContact) {
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

    const linkedCustomer = linkedCustomerFromMachine ?? customer;

    if (exactLinkedMachine) {
      summary.linkedExact += 1;
    } else if (preservedLinkedMachine) {
      summary.linkedPreserved += 1;
    } else if (!row.vehicleSerialKey) {
      summary.unlinkedNoVehicleSerial += 1;
    } else if (matchedVehicles.length > 1) {
      summary.unlinkedAmbiguous += 1;
    } else {
      summary.unlinkedNoMatch += 1;
    }

    const machinePayload = {
      customer_id: linkedCustomer.id,
      machine_number: row.machine.machineNumber,
      machine_type: "batterij_lader",
      availability_status: "available",
      brand: row.machine.brand,
      model: row.machine.model,
      serial_number: row.machine.serialNumber || null,
      build_year: Number(row.machine.buildYear || 0) || null,
      internal_number: row.machine.internalNumber || null,
      configuration: compactConfig({
        ...(machine?.configuration ?? {}),
        ...row.machine.configuration,
        ...(linkedMachine ? { linked_machine_id: linkedMachine.id } : {}),
        ...(machine?.configuration && !linkedMachine && machine.configuration.linked_machine_id
          ? { linked_machine_id: machine.configuration.linked_machine_id }
          : {})
      })
    };

    if (!machine) {
      const { data, error } = await supabase
        .from("machines")
        .insert(machinePayload)
        .select("id, machine_number")
        .single();
      if (error || !data) {
        throw new Error(`B/L kaart aanmaken mislukt voor ${row.machine.machineNumber}: ${error?.message ?? "onbekende fout"}`);
      }
      machine = {
        id: String(data.id),
        machineNumber: String(data.machine_number ?? ""),
        customerId: String(data.customer_id ?? linkedCustomer.id),
        machineType: "batterij_lader",
        serialNumber: row.machine.serialNumber || "",
        configuration: machinePayload.configuration
      };
      machinesByNumber.set(machineKey, machine);
      machinesById.set(machine.id, machine);
      summary.machinesCreated += 1;
    } else {
      const { error } = await supabase.from("machines").update(machinePayload).eq("id", machine.id);
      if (error) {
        throw new Error(`B/L kaart bijwerken mislukt voor ${row.machine.machineNumber}: ${error.message}`);
      }
      machine.customerId = linkedCustomer.id;
      machine.serialNumber = row.machine.serialNumber || machine.serialNumber;
      machine.configuration = machinePayload.configuration;
      machinesById.set(machine.id, machine);
      summary.machinesUpdated += 1;
    }

    const inspectionKey = `${machine.id}|${row.inspectionDate}`;
    if (inspectionKeys.has(inspectionKey)) {
      summary.inspectionsSkipped += 1;
      continue;
    }

    const { data: inspectionNumber, error: inspectionNumberError } = await supabase.rpc(
      "next_inspection_number",
      { target_date: row.inspectionDate }
    );
    if (inspectionNumberError || inspectionNumber == null) {
      throw new Error(
        `Keurnummer genereren mislukt voor ${row.customerName} / ${row.machine.machineNumber}: ${inspectionNumberError?.message ?? "onbekende fout"}`
      );
    }

    const nextInspectionDate = addTwelveMonths(row.inspectionDate);
    const inspectionPayload = {
      inspection_number: String(inspectionNumber),
      customer_id: linkedCustomer.id,
      machine_id: machine.id,
      machine_type: "batterij_lader",
      inspection_date: row.inspectionDate,
      next_inspection_date: nextInspectionDate,
      status: row.status,
      send_pdf_to_customer: false,
      checklist: row.checklist,
      customer_snapshot: buildCustomerSnapshot({
        companyName: linkedCustomer.companyName,
        address: linkedCustomer.address,
        contactName: row.customerContact || linkedCustomer.contactName,
        phone: linkedCustomer.phone,
        email: linkedCustomer.email
      }),
      machine_snapshot: buildMachineSnapshot(row.machine),
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

    const state = new Date(nextInspectionDate) < new Date() ? "overdue" : "scheduled";
    const { error: planningError } = await supabase.from("planning_items").insert({
      inspection_id: String(inspectionData.id),
      customer_id: linkedCustomer.id,
      machine_id: machine.id,
      due_date: nextInspectionDate,
      state
    });
    if (planningError) {
      throw new Error(
        `Planning aanmaken mislukt voor ${row.customerName} / ${row.machine.machineNumber}: ${planningError.message}`
      );
    }

    inspectionKeys.add(inspectionKey);
    summary.inspectionsCreated += 1;
    summary.planningCreated += 1;
  }

  console.log("Import afgerond.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
