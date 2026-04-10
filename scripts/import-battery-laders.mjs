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
    .map((line) => line.trim())
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
    if (lowered.startsWith("contact ")) {
      contactName = line.slice(8).trim();
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

  return { companyName, city, contactName };
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
  if (normalized.includes("nvt")) return "nvt";
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
  const batteryBrand = clean(row["Fabricaat"]);
  const chargerBrand = clean(row["Fabricaat__2"]);
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
    customerCity: customer.city,
    customerContact: customer.contactName,
    inspectionDate: normalizeDate(row["Keuringsdatum"]),
    findings: clean(row["Bevindingen"]),
    recommendations: clean(row["Aanbevelingen"]),
    conclusion: clean(row["Conclusie"]),
    status: deriveStatus(row["Conclusie"]),
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
        double_insulated: clean(row["Dubbel geïsoleerd"]),
        source_submission_time: clean(row["Inzendingstijd"])
      })
    },
    checklist: buildChecklist(row)
  };
}

function normalizeKey(value) {
  return clean(value).toLowerCase();
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
  const parsedRows = parseCsv(raw).map(mapRow).filter((row) => row.customerName && row.machine.machineNumber);

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
  const machinesByNumber = new Map(
    (machineRows.data ?? []).map((row) => [
      normalizeKey(row.machine_number),
      {
        id: String(row.id),
        machineNumber: String(row.machine_number ?? "")
      }
    ])
  );
  const inspectionKeys = new Set(
    (inspectionRows.data ?? []).map((row) => `${String(row.machine_id)}|${String(row.inspection_date)}`)
  );

  const summary = {
    customersCreated: 0,
    contactsCreated: 0,
    machinesCreated: 0,
    machinesUpdated: 0,
    inspectionsCreated: 0,
    inspectionsSkipped: 0,
    planningCreated: 0
  };

  for (const row of parsedRows) {
    const customerKey = normalizeKey(row.customerName);
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
          email: null
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
    } else {
      const nextCity = customer.city || row.customerCity;
      const nextContactName = customer.contactName || row.customerContact;
      if (nextCity !== customer.city || nextContactName !== customer.contactName) {
        const { error } = await supabase
          .from("customers")
          .update({
            city: nextCity || null,
            contact_name: nextContactName || null
          })
          .eq("id", customer.id);
        if (error) {
          throw new Error(`Klant bijwerken mislukt voor ${row.customerName}: ${error.message}`);
        }
        customer.city = nextCity;
        customer.contactName = nextContactName;
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
          email: null,
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

    const machineKey = normalizeKey(row.machine.machineNumber);
    let machine = machinesByNumber.get(machineKey) ?? null;

    const machinePayload = {
      customer_id: customer.id,
      machine_number: row.machine.machineNumber,
      machine_type: "batterij_lader",
      availability_status: "available",
      brand: row.machine.brand,
      model: row.machine.model,
      serial_number: row.machine.serialNumber || null,
      build_year: Number(row.machine.buildYear || 0) || null,
      internal_number: row.machine.internalNumber || null,
      configuration: row.machine.configuration
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
        machineNumber: String(data.machine_number ?? "")
      };
      machinesByNumber.set(machineKey, machine);
      summary.machinesCreated += 1;
    } else {
      const { error } = await supabase.from("machines").update(machinePayload).eq("id", machine.id);
      if (error) {
        throw new Error(`B/L kaart bijwerken mislukt voor ${row.machine.machineNumber}: ${error.message}`);
      }
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
      customer_id: customer.id,
      machine_id: machine.id,
      machine_type: "batterij_lader",
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
        email: customer.email
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
      customer_id: customer.id,
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
