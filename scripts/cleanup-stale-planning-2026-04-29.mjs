import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const raw = await fs.readFile(".env.local", "utf8");
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;
  process.env[trimmed.slice(0, separator).trim()] ||= trimmed.slice(separator + 1).trim();
}

const apply = process.argv.includes("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: inspections, error: inspectionError } = await supabase
  .from("inspections")
  .select("id, inspection_number, machine_id, next_inspection_date")
  .gte("inspection_number", 20260244)
  .lte("inspection_number", 20260255);
if (inspectionError) throw inspectionError;

const latestByMachine = new Map((inspections ?? []).map((inspection) => [inspection.machine_id, inspection]));
const machineIds = [...latestByMachine.keys()];
const { data: planning, error: planningError } = await supabase
  .from("planning_items")
  .select("*")
  .in("machine_id", machineIds)
  .neq("state", "completed")
  .order("due_date", { ascending: true });
if (planningError) throw planningError;

const stale = (planning ?? []).filter((item) => {
  const latest = latestByMachine.get(item.machine_id);
  return latest && item.inspection_id !== latest.id && item.due_date <= latest.next_inspection_date;
});

console.table(
  stale.map((item) => ({
    id: item.id,
    inspection: item.inspection_id,
    due: item.due_date,
    state: item.state,
    notes: item.notes
  }))
);

if (apply && stale.length > 0) {
  const { error } = await supabase
    .from("planning_items")
    .update({ state: "completed" })
    .in(
      "id",
      stale.map((item) => item.id)
    );
  if (error) throw error;
  console.log("Afgerond gezet:", stale.length);
}
