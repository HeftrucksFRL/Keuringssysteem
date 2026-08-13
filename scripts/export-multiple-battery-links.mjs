import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const reportDate = new Date().toISOString().slice(0, 10);
const outputBase = path.join(process.cwd(), "docs", `controle-meervoudige-batterijkoppelingen-${reportDate}`);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function csvCell(value) {
  const text = clean(value);
  return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function archived(machine) {
  return Boolean(machine?.configuration?.__archivedAt);
}

async function loadEnv() {
  const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function fetchAll(queryFactory) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

await loadEnv();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const [machines, customers, inspections] = await Promise.all([
  fetchAll((from, to) =>
    supabase
      .from("machines")
      .select("id, customer_id, machine_number, machine_type, brand, model, serial_number, internal_number, configuration, created_at, updated_at")
      .order("machine_number", { ascending: true })
      .range(from, to)
  ),
  fetchAll((from, to) =>
    supabase.from("customers").select("id, company_name").order("company_name").range(from, to)
  ),
  fetchAll((from, to) =>
    supabase
      .from("inspections")
      .select("inspection_number, machine_id, inspection_date")
      .order("inspection_date", { ascending: false })
      .range(from, to)
  )
]);

const machinesById = new Map(machines.map((machine) => [machine.id, machine]));
const customersById = new Map(customers.map((customer) => [customer.id, customer]));
const inspectionsByMachineId = new Map();
for (const inspection of inspections) {
  const list = inspectionsByMachineId.get(inspection.machine_id) ?? [];
  list.push(inspection);
  inspectionsByMachineId.set(inspection.machine_id, list);
}

const groups = new Map();
for (const battery of machines.filter((machine) => machine.machine_type === "batterij_lader")) {
  const linkedMachineId = clean(battery.configuration?.linked_machine_id);
  if (!linkedMachineId) continue;
  const list = groups.get(linkedMachineId) ?? [];
  list.push(battery);
  groups.set(linkedMachineId, list);
}

const multipleGroups = [...groups.entries()]
  .filter(([, batteries]) => batteries.length > 1)
  .map(([vehicleId, batteries]) => ({ vehicle: machinesById.get(vehicleId), batteries }))
  .filter((group) => group.vehicle)
  .sort((left, right) => {
    const leftCustomer = customersById.get(left.vehicle.customer_id)?.company_name ?? "";
    const rightCustomer = customersById.get(right.vehicle.customer_id)?.company_name ?? "";
    return leftCustomer.localeCompare(rightCustomer, "nl") ||
      clean(left.vehicle.machine_number).localeCompare(clean(right.vehicle.machine_number), "nl");
  });

const headers = [
  "groep",
  "klant",
  "voertuig_machine_nummer",
  "voertuig_type",
  "voertuig_merk_model",
  "voertuig_serienummer",
  "voertuig_gearchiveerd",
  "aantal_gekoppelde_kaarten",
  "batterij_lader_machine_nummer",
  "batterij_lader_gearchiveerd",
  "batterij_merk_type",
  "batterij_serienummer",
  "lader_merk_type",
  "voertuignummer_op_batterijkaart",
  "keuringshistorie_batterij_lader",
  "voertuig_id",
  "batterij_lader_id",
  "oordeel_age",
  "opmerking_age"
];

const rows = [];
const summaryRows = [];
for (const [index, group] of multipleGroups.entries()) {
  const groupNumber = index + 1;
  const customer = customersById.get(group.vehicle.customer_id)?.company_name ?? "Onbekende klant";
  const batteryLabels = [];

  for (const battery of group.batteries) {
    const configuration = battery.configuration ?? {};
    const history = (inspectionsByMachineId.get(battery.id) ?? [])
      .map((inspection) => `${inspection.inspection_number} (${inspection.inspection_date})`)
      .join(" | ");
    const batteryLabel = [configuration.battery_brand, configuration.battery_type]
      .map(clean)
      .filter(Boolean)
      .join(" ") || clean(battery.machine_number);
    batteryLabels.push(`${batteryLabel}${archived(battery) ? " [archief]" : ""}`);

    rows.push({
      groep: groupNumber,
      klant: customer,
      voertuig_machine_nummer: group.vehicle.machine_number,
      voertuig_type: group.vehicle.machine_type,
      voertuig_merk_model: [group.vehicle.brand, group.vehicle.model].map(clean).filter(Boolean).join(" "),
      voertuig_serienummer: group.vehicle.serial_number,
      voertuig_gearchiveerd: archived(group.vehicle) ? "ja" : "nee",
      aantal_gekoppelde_kaarten: group.batteries.length,
      batterij_lader_machine_nummer: battery.machine_number,
      batterij_lader_gearchiveerd: archived(battery) ? "ja" : "nee",
      batterij_merk_type: [configuration.battery_brand, configuration.battery_type].map(clean).filter(Boolean).join(" "),
      batterij_serienummer: configuration.battery_serial_number,
      lader_merk_type: [configuration.charger_brand, configuration.charger_type].map(clean).filter(Boolean).join(" "),
      voertuignummer_op_batterijkaart: configuration.vehicle_serial_number,
      keuringshistorie_batterij_lader: history,
      voertuig_id: group.vehicle.id,
      batterij_lader_id: battery.id,
      oordeel_age: "",
      opmerking_age: ""
    });
  }

  summaryRows.push(
    `| ${groupNumber} | ${customer} | ${clean(group.vehicle.machine_number)} | ${group.batteries.length} | ${batteryLabels.join("<br>")} | |`
  );
}

const csv = [
  headers.map(csvCell).join(";"),
  ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(";"))
].join("\r\n");

const markdown = [
  "# Controle meervoudige batterij-/laderkoppelingen",
  "",
  `Productiestand van ${reportDate}. Alleen voertuigen met meer dan één gekoppelde batterij-/laderkaart staan in deze lijst.`,
  "",
  "Age kan per groep aangeven of alle kaarten behouden moeten blijven, of welke kaart dubbel/verkeerd is. Gearchiveerde kaarten zijn expliciet gemarkeerd.",
  "",
  `- Voertuigen ter controle: **${multipleGroups.length}**`,
  `- Gekoppelde batterij-/laderkaarten in deze groepen: **${rows.length}**`,
  "",
  "| Groep | Klant | Voertuig | Aantal | Batterij-/laderkaarten | Oordeel Age |",
  "|---:|---|---|---:|---|---|",
  ...summaryRows,
  "",
  `De bewerkbare detailversie staat in \`${path.basename(outputBase)}.csv\`.`,
  ""
].join("\n");

await Promise.all([
  writeFile(`${outputBase}.csv`, `${csv}\r\n`, "utf8"),
  writeFile(`${outputBase}.md`, markdown, "utf8")
]);

console.log(`Controlelijst klaar: ${multipleGroups.length} voertuigen, ${rows.length} gekoppelde kaarten.`);
console.log(`${outputBase}.md`);
console.log(`${outputBase}.csv`);
