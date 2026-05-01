import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TARGET_LOCAL_DATE = "2026-04-29";

function hasFlag(name) {
  return process.argv.includes(name);
}

async function loadEnv() {
  const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
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
    if (!process.env[key]) process.env[key] = value;
  }
}

function localDateRangeUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  return {
    startIso: new Date(Date.UTC(year, month - 1, day - 1, 22, 0, 0, 0)).toISOString(),
    endIso: new Date(Date.UTC(year, month - 1, day, 21, 59, 59, 999)).toISOString()
  };
}

function addTwelveMonths(date) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result.toISOString().slice(0, 10);
}

function actorGroup(logs) {
  const text = logs
    .map((log) => `${log.actor_name ?? ""} ${log.actor_email ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (text.includes("jolanda")) return "Jolanda";
  if (text.includes("age") || text.includes("terpstra")) return "Age";
  return "Onbekend";
}

function stateForDueDate(dueDate) {
  return dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming";
}

async function main() {
  await loadEnv();
  const apply = hasFlag("--apply");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
  const { startIso, endIso } = localDateRangeUtc(TARGET_LOCAL_DATE);

  const { data: inspections, error: inspectionError } = await supabase
    .from("inspections")
    .select("id, inspection_number, customer_id, machine_id, machine_type, inspection_date, next_inspection_date, status, created_at, customer_snapshot, machine_snapshot")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });
  if (inspectionError) throw new Error(inspectionError.message);

  const inspectionIds = (inspections ?? []).map((inspection) => inspection.id);
  const machineIds = [...new Set((inspections ?? []).map((inspection) => inspection.machine_id))];

  const [{ data: logs, error: logError }, { data: planning, error: planningError }] =
    await Promise.all([
      inspectionIds.length
        ? supabase
            .from("activity_logs")
            .select("entity_id, actor_name, actor_email, action, created_at")
            .eq("entity_type", "inspection")
            .in("entity_id", inspectionIds)
        : { data: [], error: null },
      machineIds.length
        ? supabase
            .from("planning_items")
            .select("*")
            .in("machine_id", machineIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null }
    ]);
  if (logError) throw new Error(logError.message);
  if (planningError) throw new Error(planningError.message);

  const logsByInspection = new Map();
  for (const log of logs ?? []) {
    const rows = logsByInspection.get(log.entity_id) ?? [];
    rows.push(log);
    logsByInspection.set(log.entity_id, rows);
  }

  const planningByInspection = new Map();
  const activePlanningByMachine = new Map();
  for (const item of planning ?? []) {
    if (item.inspection_id) planningByInspection.set(item.inspection_id, item);
    if (item.state !== "completed") {
      const rows = activePlanningByMachine.get(item.machine_id) ?? [];
      rows.push(item);
      activePlanningByMachine.set(item.machine_id, rows);
    }
  }

  const rows = (inspections ?? []).map((inspection) => {
    const dueDate = inspection.next_inspection_date || addTwelveMonths(inspection.inspection_date);
    const directPlanning = planningByInspection.get(inspection.id) ?? null;
    const activeForMachine = activePlanningByMachine.get(inspection.machine_id) ?? [];
    const logsForInspection = logsByInspection.get(inspection.id) ?? [];
    return {
      inspection,
      group: actorGroup(logsForInspection),
      dueDate,
      directPlanning,
      activeForMachine,
      actor: logsForInspection
        .map((log) => `${log.actor_name ?? ""} <${log.actor_email ?? ""}>`)
        .join(" | ")
    };
  });

  const summary = rows.reduce((acc, row) => {
    acc[row.group] ??= { inspections: 0, directPlanning: 0, missingDirectPlanning: 0 };
    acc[row.group].inspections += 1;
    if (row.directPlanning) acc[row.group].directPlanning += 1;
    else acc[row.group].missingDirectPlanning += 1;
    return acc;
  }, {});

  console.log("Samenvatting", summary);
  console.table(
    rows.map((row) => ({
      actor: row.group,
      number: row.inspection.inspection_number,
      date: row.inspection.inspection_date,
      due: row.dueDate,
      directPlanning: row.directPlanning ? "ja" : "nee",
      activeForMachine: row.activeForMachine.length,
      activeDue: row.activeForMachine.map((item) => item.due_date).join(" | "),
      machine: [row.inspection.machine_snapshot?.brand, row.inspection.machine_snapshot?.model, row.inspection.machine_snapshot?.serial_number]
        .filter(Boolean)
        .join(" "),
      actorLog: row.actor
    }))
  );

  const toRepair = rows.filter((row) => row.group === "Age" && !row.directPlanning);
  console.log("Age te herstellen:", toRepair.length);

  if (!apply) return;

  for (const row of toRepair) {
    const target = row.activeForMachine.find((item) => item.state !== "completed");
    const payload = {
      inspection_id: row.inspection.id,
      customer_id: row.inspection.customer_id,
      machine_id: row.inspection.machine_id,
      due_date: row.dueDate,
      state: stateForDueDate(row.dueDate),
      notes: "Automatische vervolgkeuring"
    };

    if (target) {
      const { error } = await supabase
        .from("planning_items")
        .update(payload)
        .eq("id", target.id);
      if (error) throw new Error(`${row.inspection.inspection_number}: ${error.message}`);
    } else {
      const { error } = await supabase.from("planning_items").insert(payload);
      if (error) throw new Error(`${row.inspection.inspection_number}: ${error.message}`);
    }
  }

  console.log("Hersteld:", toRepair.map((row) => row.inspection.inspection_number));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
