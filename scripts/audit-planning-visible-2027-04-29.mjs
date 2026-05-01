import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const TARGET_DUE_DATE = "2027-04-29";
const START_NUMBER = 20260244;
const END_NUMBER = 20260255;

const raw = await fs.readFile(".env.local", "utf8");
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;
  process.env[trimmed.slice(0, separator).trim()] ||= trimmed.slice(separator + 1).trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: inspections, error: inspectionError } = await supabase
  .from("inspections")
  .select("id, inspection_number, customer_id, machine_id, status, next_inspection_date, customer_snapshot, machine_snapshot")
  .gte("inspection_number", START_NUMBER)
  .lte("inspection_number", END_NUMBER)
  .order("inspection_number", { ascending: true });
if (inspectionError) throw inspectionError;

const inspectionIds = inspections.map((inspection) => inspection.id);
const customerIds = [...new Set(inspections.map((inspection) => inspection.customer_id))];
const machineIds = [...new Set(inspections.map((inspection) => inspection.machine_id))];

const [
  { data: planning, error: planningError },
  { data: customers, error: customerError },
  { data: machines, error: machineError }
] = await Promise.all([
  supabase
    .from("planning_items")
    .select("*")
    .in("inspection_id", inspectionIds)
    .order("due_date", { ascending: true }),
  supabase.from("customers").select("id, company_name").in("id", customerIds),
  supabase.from("machines").select("id, machine_number, brand, model, serial_number, configuration").in("id", machineIds)
]);
if (planningError) throw planningError;
if (customerError) throw customerError;
if (machineError) throw machineError;

const planningByInspection = new Map((planning ?? []).map((item) => [item.inspection_id, item]));
const customersById = new Map((customers ?? []).map((item) => [item.id, item]));
const machinesById = new Map((machines ?? []).map((item) => [item.id, item]));

console.table(
  inspections.map((inspection) => {
    const item = planningByInspection.get(inspection.id);
    const machine = machinesById.get(inspection.machine_id);
    return {
      number: inspection.inspection_number,
      status: inspection.status,
      next: inspection.next_inspection_date,
      planningDue: item?.due_date ?? "",
      planningState: item?.state ?? "",
      visibleDate: item?.due_date === TARGET_DUE_DATE && item?.state !== "completed" ? "ja" : "nee",
      customer: customersById.get(inspection.customer_id)?.company_name ?? "",
      machine: [machine?.brand, machine?.model, machine?.serial_number].filter(Boolean).join(" ")
    };
  })
);

const visibleRows = (planning ?? []).filter((item) => item.due_date === TARGET_DUE_DATE && item.state !== "completed");
const grouped = new Map();
for (const item of visibleRows) {
  const key = `${item.customer_id}-${item.due_date}`;
  grouped.set(key, (grouped.get(key) ?? 0) + 1);
}

console.log("Visible planning rows:", visibleRows.length);
console.table([...grouped].map(([key, count]) => ({ key, count })));
