import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const machines = await fetchAll((from, to) =>
  supabase
    .from("machines")
    .select(
      "id, customer_id, machine_number, machine_type, brand, model, serial_number, internal_number, configuration"
    )
    .range(from, to)
);
const customers = await fetchAll((from, to) =>
  supabase.from("customers").select("id, company_name").range(from, to)
);
const machineById = new Map(machines.map((machine) => [machine.id, machine]));
const customerById = new Map(customers.map((customer) => [customer.id, customer.company_name]));
const batteries = machines.filter((machine) => machine.machine_type === "batterij_lader");
const linkedGroups = new Map();
const issues = {
  dangling: [],
  linkedToBattery: [],
  archivedTarget: [],
  customerMismatch: []
};

for (const battery of batteries) {
  const linkedMachineId = String(battery.configuration?.linked_machine_id ?? "").trim();
  if (!linkedMachineId) continue;

  linkedGroups.set(linkedMachineId, (linkedGroups.get(linkedMachineId) ?? 0) + 1);
  const linkedMachine = machineById.get(linkedMachineId);
  if (!linkedMachine) {
    issues.dangling.push(battery.id);
    continue;
  }
  if (linkedMachine.machine_type === "batterij_lader") {
    issues.linkedToBattery.push(battery.id);
  }
  if (linkedMachine.configuration?.__archivedAt) {
    issues.archivedTarget.push(battery.id);
  }
  if (battery.customer_id !== linkedMachine.customer_id) {
    issues.customerMismatch.push(battery.id);
  }
}

const linkedCount = batteries.filter((battery) =>
  String(battery.configuration?.linked_machine_id ?? "").trim()
).length;

function machineDetails(machine) {
  if (!machine) return null;
  return {
    id: machine.id,
    klant: customerById.get(machine.customer_id) ?? machine.customer_id,
    merk: machine.brand ?? "",
    type: machine.model ?? "",
    internNummer: machine.internal_number ?? "",
    machineNummer: machine.machine_number ?? "",
    serienummer: machine.serial_number ?? "",
    gearchiveerd: Boolean(machine.configuration?.__archivedAt)
  };
}

function issueDetails(batteryId) {
  const battery = machineById.get(batteryId);
  const linkedMachineId = String(battery?.configuration?.linked_machine_id ?? "").trim();
  return {
    batterijLader: machineDetails(battery),
    gekoppeldAan: machineDetails(machineById.get(linkedMachineId)) ?? { id: linkedMachineId }
  };
}

console.log(JSON.stringify({
  totalBatteryChargerCards: batteries.length,
  linked: linkedCount,
  unlinked: batteries.length - linkedCount,
  trucksWithMultipleCards: [...linkedGroups.values()].filter((count) => count > 1).length,
  issues: Object.fromEntries(
    Object.entries(issues).map(([key, ids]) => [
      key,
      { count: ids.length, records: ids.map(issueDetails) }
    ])
  )
}, null, 2));
