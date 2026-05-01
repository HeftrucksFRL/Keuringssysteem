import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const FROM_DATE = "2026-04-13";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function addTwelveMonths(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function loadEnv() {
  const raw = await fs.readFile(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator).trim()] ||= trimmed.slice(separator + 1).trim();
  }
}

await loadEnv();

const apply = hasFlag("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: inspections, error: inspectionError } = await supabase
  .from("inspections")
  .select("id, inspection_number, customer_id, machine_id, inspection_date, next_inspection_date, status, customer_snapshot, machine_snapshot")
  .gte("inspection_date", FROM_DATE)
  .order("inspection_date", { ascending: true })
  .order("inspection_number", { ascending: true });

if (inspectionError) throw inspectionError;

const inspectionIds = (inspections ?? []).map((inspection) => inspection.id);
const { data: planningRows, error: planningError } = inspectionIds.length
  ? await supabase
      .from("planning_items")
      .select("*")
      .in("inspection_id", inspectionIds)
      .neq("state", "completed")
  : { data: [], error: null };

if (planningError) throw planningError;

const planningByInspectionId = new Map((planningRows ?? []).map((row) => [row.inspection_id, row]));
const missing = (inspections ?? []).filter((inspection) => !planningByInspectionId.has(inspection.id));
const wrongNextInspectionDate = (inspections ?? []).filter((inspection) => {
  const expected = addTwelveMonths(inspection.inspection_date);
  return inspection.next_inspection_date !== expected;
});
const wrongDueDate = (inspections ?? []).filter((inspection) => {
  const planning = planningByInspectionId.get(inspection.id);
  if (!planning) return false;
  const expected = addTwelveMonths(inspection.inspection_date);
  return planning.due_date !== expected;
});

console.log(
  JSON.stringify(
    {
      apply,
      fromDate: FROM_DATE,
      inspections: inspections?.length ?? 0,
      activePlanningLinks: planningRows?.length ?? 0,
      missing: missing.length,
      wrongNextInspectionDate: wrongNextInspectionDate.length,
      wrongDueDate: wrongDueDate.length
    },
    null,
    2
  )
);

console.table(
  [...missing, ...wrongDueDate].map((inspection) => {
    const planning = planningByInspectionId.get(inspection.id);
    return {
      number: inspection.inspection_number,
      date: inspection.inspection_date,
      status: inspection.status,
      nextInspectionDate: inspection.next_inspection_date,
      expectedDue: addTwelveMonths(inspection.inspection_date),
      currentDue: planning?.due_date ?? "",
      customer: inspection.customer_snapshot?.customer_name ?? "",
      machine: [inspection.machine_snapshot?.brand, inspection.machine_snapshot?.model, inspection.machine_snapshot?.serial_number]
        .filter(Boolean)
        .join(" ")
    };
  })
);

if (!apply) process.exit(0);

for (const inspection of wrongNextInspectionDate) {
  const dueDate = addTwelveMonths(inspection.inspection_date);
  const { error } = await supabase
    .from("inspections")
    .update({ next_inspection_date: dueDate })
    .eq("id", inspection.id);
  if (error) throw new Error(`${inspection.inspection_number}: ${error.message}`);
}

for (const inspection of missing) {
  const dueDate = addTwelveMonths(inspection.inspection_date);
  const { error } = await supabase.from("planning_items").insert({
    inspection_id: inspection.id,
    customer_id: inspection.customer_id,
    machine_id: inspection.machine_id,
    due_date: dueDate,
    state: dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming",
    notes: "Automatische vervolgkeuring"
  });
  if (error) throw new Error(`${inspection.inspection_number}: ${error.message}`);
}

for (const inspection of wrongDueDate) {
  const dueDate = addTwelveMonths(inspection.inspection_date);
  const planning = planningByInspectionId.get(inspection.id);
  const { error } = await supabase
    .from("planning_items")
    .update({
      due_date: dueDate,
      state: dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming",
      notes: "Automatische vervolgkeuring"
    })
    .eq("id", planning.id);
  if (error) throw new Error(`${inspection.inspection_number}: ${error.message}`);
}

console.log("Repaired", {
  inserted: missing.length,
  nextInspectionDateUpdated: wrongNextInspectionDate.length,
  planningUpdated: wrongDueDate.length
});
