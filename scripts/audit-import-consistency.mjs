import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const cwd = process.cwd();
  return {
    summary: path.join(cwd, "Import-audit-overzicht.md"),
    customers: path.join(cwd, "Import-audit-klantdubbels.csv"),
    batteries: path.join(cwd, "Import-audit-batterij-laders.csv"),
    ...Object.fromEntries(
      argv.reduce((pairs, item, index) => {
        if (item === "--summary") pairs.push(["summary", argv[index + 1] ?? ""]);
        if (item === "--customers") pairs.push(["customers", argv[index + 1] ?? ""]);
        if (item === "--batteries") pairs.push(["batteries", argv[index + 1] ?? ""]);
        return pairs;
      }, [])
    )
  };
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
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalizeWhitespace(value) {
  return clean(value).replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeLooseName(value) {
  return normalizeKey(value)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\b(bv|b\.v|b\.v\.|vof|vof\.|bvba|holding|groep)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  const normalized = clean(value).replace(/[^\d+]/g, "");
  return normalized.replace(/\D/g, "").length >= 7 ? normalized : "";
}

function normalizeSerial(value) {
  return clean(value).replace(/\s+/g, "").toLowerCase();
}

function normalizeAddress(address, city) {
  const normalizedAddress = clean(address);
  const normalizedCity = clean(city);
  if (!normalizedAddress || !normalizedCity) return "";
  return normalizeKey(`${normalizedAddress} ${normalizedCity}`.trim());
}

function normalizeEmail(value) {
  const normalized = normalizeKey(value);
  return normalized.includes("@") ? normalized : "";
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

async function fetchAll(supabase, table, select, options = {}) {
  const pageSize = options.pageSize ?? 1000;
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);

    if (options.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? true
      });
    }

    for (const filter of options.filters ?? []) {
      if (filter.type === "eq") query = query.eq(filter.column, filter.value);
      if (filter.type === "neq") query = query.neq(filter.column, filter.value);
      if (filter.type === "in") query = query.in(filter.column, filter.value);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Ophalen uit ${table} mislukt: ${error.message}`);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function createUnionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));

  function find(id) {
    let current = parent.get(id) ?? id;
    while (current !== (parent.get(current) ?? current)) {
      current = parent.get(current) ?? current;
    }
    let cursor = id;
    while (cursor !== current) {
      const next = parent.get(cursor) ?? cursor;
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  }

  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  }

  return { find, union };
}

function addGroupRelations(items, getKey, reason, unionFind, relationReasons) {
  const groups = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  for (const groupItems of groups.values()) {
    if (groupItems.length < 2) continue;
    const [first, ...rest] = groupItems;
    for (const item of rest) {
      unionFind.union(first.id, item.id);
    }
    for (const item of groupItems) {
      const bucket = relationReasons.get(item.id) ?? new Set();
      bucket.add(reason);
      relationReasons.set(item.id, bucket);
    }
  }
}

function scoreCustomer(customer) {
  let score = 0;
  score += clean(customer.address_line_1) ? 3 : 0;
  score += clean(customer.city) ? 2 : 0;
  score += clean(customer.email) ? 2 : 0;
  score += clean(customer.phone) ? 2 : 0;
  score += clean(customer.contact_name) ? 1 : 0;
  score += clean(customer.company_name).length / 100;
  return score;
}

function detectCustomerDuplicateGroups(customers) {
  const ids = customers.map((customer) => customer.id);
  const unionFind = createUnionFind(ids);
  const relationReasons = new Map();

  addGroupRelations(
    customers,
    (customer) => normalizeLooseName(customer.company_name),
    "zelfde basisnaam",
    unionFind,
    relationReasons
  );
  addGroupRelations(
    customers,
    (customer) => normalizeAddress(customer.address_line_1, customer.city),
    "zelfde adres + plaats",
    unionFind,
    relationReasons
  );
  addGroupRelations(
    customers,
    (customer) => normalizeEmail(customer.email),
    "zelfde e-mailadres",
    unionFind,
    relationReasons
  );
  addGroupRelations(
    customers,
    (customer) => normalizePhone(customer.phone),
    "zelfde telefoonnummer",
    unionFind,
    relationReasons
  );

  const sortedCustomers = [...customers].sort((left, right) =>
    normalizeLooseName(left.company_name).localeCompare(normalizeLooseName(right.company_name))
  );

  for (let index = 0; index < sortedCustomers.length; index += 1) {
    const current = sortedCustomers[index];
    const currentLoose = normalizeLooseName(current.company_name);
    if (!currentLoose) continue;

    for (let innerIndex = index + 1; innerIndex < sortedCustomers.length; innerIndex += 1) {
      const candidate = sortedCustomers[innerIndex];
      const candidateLoose = normalizeLooseName(candidate.company_name);
      if (!candidateLoose) continue;
      if (candidateLoose[0] !== currentLoose[0]) break;

      const sameCity =
        normalizeKey(current.city) &&
        normalizeKey(current.city) === normalizeKey(candidate.city);
      const oneContainsOther =
        currentLoose.includes(candidateLoose) || candidateLoose.includes(currentLoose);

      if (sameCity && oneContainsOther) {
        unionFind.union(current.id, candidate.id);
        for (const item of [current, candidate]) {
          const bucket = relationReasons.get(item.id) ?? new Set();
          bucket.add("naamvariant in dezelfde plaats");
          relationReasons.set(item.id, bucket);
        }
      }
    }
  }

  const groups = new Map();
  for (const customer of customers) {
    const root = unionFind.find(customer.id);
    const current = groups.get(root) ?? [];
    current.push(customer);
    groups.set(root, current);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const reasons = new Set();
      for (const customer of group) {
        for (const reason of relationReasons.get(customer.id) ?? []) {
          reasons.add(reason);
        }
      }

      const sorted = [...group].sort((left, right) => scoreCustomer(right) - scoreCustomer(left));
      const canonical = sorted[0];
      const autoMerge =
        reasons.has("zelfde e-mailadres") ||
        reasons.has("zelfde telefoonnummer") ||
        (reasons.has("zelfde adres + plaats") && reasons.has("naamvariant in dezelfde plaats")) ||
        (reasons.has("zelfde adres + plaats") && reasons.has("zelfde basisnaam"));

      return {
        canonical,
        members: sorted,
        reasons: [...reasons].sort(),
        autoMerge
      };
    })
    .sort((left, right) => right.members.length - left.members.length);
}

function buildBatteryAuditRows(machines, customersById, inspectionsByMachineId) {
  const machinesById = new Map(machines.map((machine) => [machine.id, machine]));
  const rows = [];

  for (const machine of machines) {
    if (machine.machine_type !== "batterij_lader") continue;

    const configuration = machine.configuration ?? {};
    const linkedMachineId = clean(configuration.linked_machine_id);
    if (!linkedMachineId) continue;

    const linkedMachine = machinesById.get(linkedMachineId) ?? null;
    if (!linkedMachine) continue;

    const customer = customersById.get(machine.customer_id) ?? null;
    const batteryBrand = clean(configuration.battery_brand);
    const batteryType = clean(configuration.battery_type);
    const batterySerial = clean(configuration.battery_serial_number);
    const chargerBrand = clean(configuration.charger_brand);
    const chargerType = clean(configuration.charger_type);
    const chargerSerial = clean(configuration.charger_serial_number);
    const vehicleBrand = clean(configuration.vehicle_brand);
    const vehicleType = clean(configuration.vehicle_type);
    const vehicleSerial = clean(configuration.vehicle_serial_number);
    const reasons = [];

    const hasOwnIdentity = Boolean(
      batteryBrand ||
        batteryType ||
        batterySerial ||
        chargerBrand ||
        chargerType ||
        chargerSerial
    );

    const titleMatchesVehicle =
      normalizeKey(machine.brand) === normalizeKey(vehicleBrand) &&
      normalizeKey(machine.model) === normalizeKey(vehicleType);

    const linkedToSelf = linkedMachine.id === machine.id;

    if (linkedToSelf) {
      reasons.push("linked_machine_id verwijst naar dezelfde kaart");
    }

    if (!hasOwnIdentity && titleMatchesVehicle) {
      reasons.push("kaarttitel komt volledig uit voertuiggegevens");
    }

    if (
      !hasOwnIdentity &&
      normalizeSerial(machine.serial_number) &&
      normalizeSerial(machine.serial_number) === normalizeSerial(vehicleSerial)
    ) {
      reasons.push("B/L serienummer is gelijk aan voertuigserienummer");
    }

    if (
      !linkedToSelf &&
      !hasOwnIdentity &&
      normalizeSerial(machine.serial_number) &&
      normalizeSerial(machine.serial_number) === normalizeSerial(linkedMachine.serial_number)
    ) {
      reasons.push("B/L serienummer is gelijk aan gekoppelde machine");
    }

    if (
      !linkedToSelf &&
      !hasOwnIdentity &&
      normalizeKey(machine.brand) === normalizeKey(linkedMachine.brand) &&
      normalizeKey(machine.model) === normalizeKey(linkedMachine.model) &&
      titleMatchesVehicle
    ) {
      reasons.push("kaart lijkt voertuiginfo te tonen in plaats van B/L-info");
    }

    if (reasons.length === 0) continue;

    const inspections = inspectionsByMachineId.get(machine.id) ?? [];
    const baseRow = {
      customer_name: customer?.company_name ?? "",
      customer_city: customer?.city ?? "",
      bl_machine_id: machine.id,
      bl_machine_number: machine.machine_number,
      bl_brand: clean(machine.brand),
      bl_model: clean(machine.model),
      bl_serial_number: clean(machine.serial_number),
      linked_machine_id: linkedMachine.id,
      linked_machine_number: clean(linkedMachine.machine_number),
      linked_machine_type: clean(linkedMachine.machine_type),
      linked_machine_brand: clean(linkedMachine.brand),
      linked_machine_model: clean(linkedMachine.model),
      linked_machine_serial_number: clean(linkedMachine.serial_number),
      vehicle_brand: vehicleBrand,
      vehicle_type: vehicleType,
      vehicle_serial_number: vehicleSerial,
      battery_brand: batteryBrand,
      battery_type: batteryType,
      battery_serial_number: batterySerial,
      charger_brand: chargerBrand,
      charger_type: chargerType,
      charger_serial_number: chargerSerial,
      reasons: reasons.join(" | "),
      suggested_action: linkedToSelf
        ? "hoog risico: controleren of bestaand voertuigrecord is overschreven of fout is gekoppeld"
        : hasOwnIdentity
          ? "handmatig controleren: B/L bestaat, maar titel lijkt vervuild"
          : "waarschijnlijk B/L-kaart opschonen of handmatig aanvullen; niet blind omzetten"
    };

    if (inspections.length === 0) {
      rows.push({
        inspection_number: "",
        inspection_date: "",
        inspection_status: "",
        ...baseRow
      });
      continue;
    }

    for (const inspection of inspections) {
      const snapshot = inspection.machine_snapshot ?? {};
      const snapshotMatchesVehicle =
        normalizeKey(snapshot.brand) === normalizeKey(vehicleBrand) &&
        normalizeKey(snapshot.model) === normalizeKey(vehicleType);
      const inspectionReasons = new Set(reasons);

      if (!hasOwnIdentity && snapshotMatchesVehicle) {
        inspectionReasons.add("rapportsnapshot volgt voertuiggegevens");
      }

      rows.push({
        inspection_number: inspection.inspection_number,
        inspection_date: inspection.inspection_date,
        inspection_status: inspection.status,
        snapshot_brand: clean(snapshot.brand),
        snapshot_model: clean(snapshot.model),
        snapshot_serial_number: clean(snapshot.serial_number),
        snapshot_matches_vehicle: snapshotMatchesVehicle ? "ja" : "nee",
        ...baseRow
      });
      rows[rows.length - 1].reasons = [...inspectionReasons].join(" | ");
    }
  }

  return rows.sort((left, right) => {
    const leftNumber = Number(left.inspection_number || 0);
    const rightNumber = Number(right.inspection_number || 0);
    return rightNumber - leftNumber;
  });
}

function formatCustomerGroupRow(group, index) {
  return {
    group_id: index + 1,
    suggested_canonical_id: group.canonical.id,
    suggested_canonical_name: group.canonical.company_name,
    auto_merge_candidate: group.autoMerge ? "ja" : "nee",
    reasons: group.reasons.join(" | "),
    customer_ids: group.members.map((member) => member.id).join(" | "),
    customer_names: group.members.map((member) => member.company_name).join(" | "),
    cities: group.members.map((member) => clean(member.city)).join(" | "),
    addresses: group.members.map((member) => clean(member.address_line_1)).join(" | "),
    emails: group.members.map((member) => clean(member.email)).join(" | "),
    phones: group.members.map((member) => clean(member.phone)).join(" | ")
  };
}

function buildSummary({
  customerGroups,
  batteryRows,
  bdsGroups,
  inspection25168
}) {
  const lines = [
    "# Import audit",
    "",
    `- Kandidaat dubbelklanten: **${customerGroups.length}** groepen`,
    `- Verdachte batterij/lader gevallen: **${batteryRows.length}** regels`,
    "",
    "## Werkwijze",
    "",
    "- Dit rapport doet **geen** merges of datamutaties.",
    "- Klantdubbels zijn gegroepeerd op basis van naamvarianten, adres, plaats, e-mailadres en telefoonnummer.",
    "- B/L-gevallen zijn gemarkeerd als de kaarttitel of het serienummer terugvalt op voertuiggegevens van de gekoppelde machine.",
    "",
    "## BDS controle",
    ""
  ];

  if (bdsGroups.length === 0) {
    lines.push("- Geen BDS-groep gevonden in de dubbelaudit.");
  } else {
    for (const group of bdsGroups) {
      lines.push(
        `- ${group.members.map((member) => member.company_name).join(" / ")}`
      );
      lines.push(`  Redenen: ${group.reasons.join(", ")}`);
    }
  }

  lines.push("", "## Keurnummer 25168", "");

  if (!inspection25168) {
    lines.push("- Keurnummer 25168 is niet gevonden.");
  } else {
    lines.push(`- Status: ${inspection25168.status}`);
    lines.push(`- Type: ${inspection25168.machine_type}`);
    lines.push(`- Datum: ${inspection25168.inspection_date}`);
    lines.push(`- Machine: ${clean(inspection25168.machine?.machine_number)} (${clean(inspection25168.machine?.brand)} ${clean(inspection25168.machine?.model)})`);
    lines.push(`- Klant: ${clean(inspection25168.customer?.company_name)}`);
    lines.push(
      `- Gekoppelde machine vanuit configuratie: ${clean(
        inspection25168.machine?.configuration?.linked_machine_id
      ) || "-"}`
    );
  }

  lines.push(
    "",
    "## Advies",
    "",
    "1. Eerst de groepen met `auto_merge_candidate = ja` nalopen.",
    "2. Daarna de verdachte B/L-regels controleren: gaat het om een echte B/L-keuring met slechte titel, of is er echt iets op het verkeerde object terechtgekomen?",
    "3. Pas daarna een reparatiescript maken voor de high-confidence gevallen."
  );

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const [customers, machines, inspections] = await Promise.all([
    fetchAll(
      supabase,
      "customers",
      "id, company_name, address_line_1, city, contact_name, phone, email, created_at",
      { orderBy: "created_at" }
    ),
    fetchAll(
      supabase,
      "machines",
      "id, customer_id, machine_number, machine_type, brand, model, serial_number, internal_number, configuration, created_at",
      { orderBy: "created_at" }
    ),
    fetchAll(
      supabase,
      "inspections",
      "id, inspection_number, machine_id, customer_id, machine_type, inspection_date, status, machine_snapshot, customer_snapshot, conclusion, created_at",
      { orderBy: "created_at" }
    )
  ]);

  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const inspectionsByMachineId = new Map();

  for (const inspection of inspections) {
    const current = inspectionsByMachineId.get(inspection.machine_id) ?? [];
    current.push(inspection);
    inspectionsByMachineId.set(inspection.machine_id, current);
  }

  const customerGroups = detectCustomerDuplicateGroups(customers);
  const batteryRows = buildBatteryAuditRows(machines, customersById, inspectionsByMachineId);
  const customerCsvRows = customerGroups.map(formatCustomerGroupRow);

  const inspection25168 = inspections
    .filter((inspection) => Number(inspection.inspection_number) === 25168)
    .map((inspection) => {
      const machine = machines.find((item) => item.id === inspection.machine_id) ?? null;
      const customer = customersById.get(inspection.customer_id) ?? null;
      return { ...inspection, machine, customer };
    })[0] ?? null;

  const bdsGroups = customerGroups.filter((group) =>
    group.members.some((member) => normalizeKey(member.company_name).includes("bds"))
  );

  await fs.writeFile(
    args.customers,
    toCsv(customerCsvRows, [
      "group_id",
      "suggested_canonical_id",
      "suggested_canonical_name",
      "auto_merge_candidate",
      "reasons",
      "customer_ids",
      "customer_names",
      "cities",
      "addresses",
      "emails",
      "phones"
    ]),
    "utf8"
  );

  await fs.writeFile(
    args.batteries,
    toCsv(batteryRows, [
      "inspection_number",
      "inspection_date",
      "inspection_status",
      "customer_name",
      "customer_city",
      "bl_machine_id",
      "bl_machine_number",
      "bl_brand",
      "bl_model",
      "bl_serial_number",
      "linked_machine_id",
      "linked_machine_number",
      "linked_machine_type",
      "linked_machine_brand",
      "linked_machine_model",
      "linked_machine_serial_number",
      "vehicle_brand",
      "vehicle_type",
      "vehicle_serial_number",
      "battery_brand",
      "battery_type",
      "battery_serial_number",
      "charger_brand",
      "charger_type",
      "charger_serial_number",
      "snapshot_brand",
      "snapshot_model",
      "snapshot_serial_number",
      "snapshot_matches_vehicle",
      "reasons",
      "suggested_action"
    ]),
    "utf8"
  );

  await fs.writeFile(
    args.summary,
    buildSummary({
      customerGroups,
      batteryRows,
      bdsGroups,
      inspection25168
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        customerDuplicateGroups: customerGroups.length,
        suspiciousBatteryRows: batteryRows.length,
        summary: args.summary,
        customers: args.customers,
        batteries: args.batteries
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
