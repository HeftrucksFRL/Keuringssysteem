import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function groupFor(log) {
  const text = `${log.actor_name ?? ""} ${log.actor_email ?? ""}`.toLowerCase();
  if (text.includes("jolanda") || text.includes("heftruckopleiding")) return "Jolanda";
  if (text.includes("age") || text.includes("terpstra")) return "Age";
  return "Onbekend";
}

async function main() {
  await loadEnv();
  const apply = process.argv.includes("--apply");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );

  const [{ data: logs, error: logError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase
        .from("activity_logs")
        .select("entity_id, actor_name, actor_email, action, created_at")
        .eq("entity_type", "inspection")
        .in("action", ["inspection.created", "inspection.updated"])
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: true })
    ]);
  if (logError) throw new Error(logError.message);
  if (profileError) throw new Error(profileError.message);

  const ids = [...new Set((logs ?? []).map((log) => log.entity_id).filter(Boolean))];
  const [{ data: inspections, error: inspectionError }, { data: planning, error: planningError }] =
    await Promise.all([
      ids.length
        ? supabase
            .from("inspections")
            .select("id, inspection_number, customer_id, machine_id, inspection_date, next_inspection_date, status, created_at")
            .in("id", ids)
        : { data: [], error: null },
      ids.length
        ? supabase.from("planning_items").select("id, inspection_id, due_date, state, notes").in("inspection_id", ids)
        : { data: [], error: null }
    ]);
  if (inspectionError) throw new Error(inspectionError.message);
  if (planningError) throw new Error(planningError.message);

  const inspectionById = new Map((inspections ?? []).map((item) => [item.id, item]));
  const planningByInspectionId = new Map((planning ?? []).map((item) => [item.inspection_id, item]));
  const latestCreateLogByInspection = new Map();
  const touchedInspectionGroups = new Map();
  for (const log of logs ?? []) {
    if (log.entity_id) {
      const groups = touchedInspectionGroups.get(log.entity_id) ?? new Set();
      groups.add(groupFor(log));
      touchedInspectionGroups.set(log.entity_id, groups);
    }
    if (log.action !== "inspection.created" || latestCreateLogByInspection.has(log.entity_id)) continue;
    latestCreateLogByInspection.set(log.entity_id, log);
  }

  const summary = {};
  for (const log of latestCreateLogByInspection.values()) {
    const inspection = inspectionById.get(log.entity_id);
    if (!inspection) continue;
    const group = groupFor(log);
    summary[group] ??= {
      inspections: 0,
      approved: 0,
      rejected: 0,
      draft: 0,
      withPlanning: 0,
      missingPlanning: 0
    };
    summary[group].inspections += 1;
    summary[group][inspection.status] = (summary[group][inspection.status] ?? 0) + 1;
    if (planningByInspectionId.has(inspection.id)) summary[group].withPlanning += 1;
    else summary[group].missingPlanning += 1;
  }

  const touchedSummary = {};
  const touchedRows = [];
  const missingTouchedByInspection = new Map();
  for (const [inspectionId, groups] of touchedInspectionGroups.entries()) {
    const inspection = inspectionById.get(inspectionId);
    if (!inspection) continue;
    for (const group of groups) {
      touchedSummary[group] ??= { touched: 0, withPlanning: 0, missingPlanning: 0 };
      touchedSummary[group].touched += 1;
      if (planningByInspectionId.has(inspectionId)) touchedSummary[group].withPlanning += 1;
      else touchedSummary[group].missingPlanning += 1;
      if (!planningByInspectionId.has(inspectionId)) {
        touchedRows.push({
          group,
          number: inspection.inspection_number,
          date: inspection.inspection_date,
          status: inspection.status,
          next: inspection.next_inspection_date
        });
        missingTouchedByInspection.set(inspectionId, inspection);
      }
    }
  }

  console.log("Profiles:");
  console.table(
    (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name ?? profile.name ?? "",
      email: profile.email ?? "",
      created: profile.created_at
    }))
  );
  console.log("Planning per gebruiker:");
  console.table(summary);
  console.log("Aangeraakte keuringen per gebruiker:");
  console.table(touchedSummary);
  console.log("Aangeraakt zonder planning:");
  console.table(touchedRows);

  if (!apply || missingTouchedByInspection.size === 0) return;

  const repairs = [];
  for (const inspection of missingTouchedByInspection.values()) {
    const dueDate = inspection.next_inspection_date;
    if (!dueDate) continue;
    const { error } = await supabase.from("planning_items").insert({
      inspection_id: inspection.id,
      customer_id: inspection.customer_id,
      machine_id: inspection.machine_id,
      due_date: dueDate,
      state: dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "upcoming",
      notes: "Automatische vervolgkeuring"
    });
    if (error) throw new Error(`${inspection.inspection_number}: ${error.message}`);
    repairs.push(inspection.inspection_number);
  }

  console.log("Hersteld:", repairs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
