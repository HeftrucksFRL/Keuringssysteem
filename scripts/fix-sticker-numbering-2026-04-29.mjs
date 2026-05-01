import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TARGET_LOCAL_DATE = "2026-04-29";
const SOURCE_START = 20261191;
const TARGET_START = 20260244;
const TARGET_LAST = 20260255;
const TARGET_YEAR = 2026;

function hasFlag(name) {
  return process.argv.includes(name);
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

function localDateRangeUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - 1, 22, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 21, 59, 59, 999));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function actorLooksLikeAge(log) {
  const text = `${log?.actor_name ?? ""} ${log?.actor_email ?? ""}`.toLowerCase();
  return text.includes("age") || text.includes("terpstra");
}

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL of service role key ontbreekt.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const apply = hasFlag("--apply");
  const sequenceOnly = hasFlag("--sequence-only");
  const { startIso, endIso } = localDateRangeUtc(TARGET_LOCAL_DATE);

  const { data: inspections, error: inspectionError } = await supabase
    .from("inspections")
    .select(
      "id, inspection_number, machine_type, inspection_date, status, created_at, updated_at, customer_snapshot, machine_snapshot"
    )
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .gte("inspection_number", SOURCE_START)
    .order("inspection_number", { ascending: true });

  if (inspectionError) {
    throw new Error(`Keuringen ophalen mislukt: ${inspectionError.message}`);
  }

  const inspectionIds = (inspections ?? []).map((row) => row.id);
  const { data: logs, error: logError } = inspectionIds.length
    ? await supabase
        .from("activity_logs")
        .select("entity_id, actor_name, actor_email, action, created_at")
        .eq("entity_type", "inspection")
        .in("entity_id", inspectionIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (logError) {
    throw new Error(`Activiteiten ophalen mislukt: ${logError.message}`);
  }

  const logsByInspection = new Map();
  for (const log of logs ?? []) {
    const current = logsByInspection.get(log.entity_id) ?? [];
    current.push(log);
    logsByInspection.set(log.entity_id, current);
  }

  const candidates = (inspections ?? []).filter((inspection) => {
    const relatedLogs = logsByInspection.get(inspection.id) ?? [];
    return relatedLogs.length === 0 || relatedLogs.some(actorLooksLikeAge);
  });

  const mappings = candidates.map((inspection, index) => ({
    id: inspection.id,
    oldNumber: Number(inspection.inspection_number),
    newNumber: TARGET_START + index,
    createdAt: inspection.created_at,
    inspectionDate: inspection.inspection_date,
    status: inspection.status,
    machineType: inspection.machine_type,
    customer: compact(inspection.customer_snapshot?.company_name),
    machine: compact(
      [
        inspection.machine_snapshot?.brand,
        inspection.machine_snapshot?.model,
        inspection.machine_snapshot?.serial_number
      ]
        .filter(Boolean)
        .join(" ")
    ),
    actors: (logsByInspection.get(inspection.id) ?? [])
      .map((log) => compact(`${log.actor_name} <${log.actor_email ?? ""}>`))
      .filter(Boolean)
      .join(" | ")
  }));

  const { data: sequenceRows, error: sequenceError } = await supabase
    .from("inspection_sequences")
    .select("sequence_year, last_number, updated_at")
    .eq("sequence_year", TARGET_YEAR);

  if (sequenceError) {
    throw new Error(`Sequence ophalen mislukt: ${sequenceError.message}`);
  }

  const { data: highRows, error: highError } = await supabase
    .from("inspections")
    .select("inspection_number")
    .gte("inspection_number", TARGET_YEAR * 10000)
    .lt("inspection_number", (TARGET_YEAR + 1) * 10000)
    .order("inspection_number", { ascending: false })
    .limit(10);

  if (highError) {
    throw new Error(`Hoogste nummers ophalen mislukt: ${highError.message}`);
  }

  const targetEnd = TARGET_START + Math.max(candidates.length - 1, 0);
  const { data: targetRows, error: targetError } = candidates.length
    ? await supabase
        .from("inspections")
        .select("id, inspection_number, created_at")
        .gte("inspection_number", TARGET_START)
        .lte("inspection_number", targetEnd)
        .not(
          "id",
          "in",
          `(${candidates.map((inspection) => `"${inspection.id}"`).join(",")})`
        )
        .order("inspection_number", { ascending: true })
    : { data: [], error: null };

  if (targetError) {
    throw new Error(`Doelnummer-check mislukt: ${targetError.message}`);
  }

  console.log(JSON.stringify({ apply, targetLocalDate: TARGET_LOCAL_DATE, utcRange: { startIso, endIso } }, null, 2));
  console.table(
    mappings.map((item) => ({
      old: item.oldNumber,
      new: item.newNumber,
      created_at: item.createdAt,
      date: item.inspectionDate,
      type: item.machineType,
      customer: item.customer,
      machine: item.machine,
      actors: item.actors
    }))
  );
  console.log("Aantal kandidaten:", mappings.length);
  console.log("Huidige sequence:", sequenceRows ?? []);
  console.log("Hoogste 2026-nummers:", (highRows ?? []).map((row) => row.inspection_number));
  console.log(
    `Conflicten in doelreeks ${TARGET_START}-${targetEnd}:`,
    (targetRows ?? []).map((row) => row.inspection_number)
  );

  if (!apply) {
    return;
  }

  if (sequenceOnly) {
    const { error: upsertError } = await supabase
      .from("inspection_sequences")
      .upsert(
        {
          sequence_year: TARGET_YEAR,
          last_number: TARGET_LAST,
          updated_at: new Date().toISOString()
        },
        { onConflict: "sequence_year" }
      );

    if (upsertError) {
      throw new Error(`Sequence bijwerken mislukt: ${upsertError.message}`);
    }

    console.log(`Sequence ${TARGET_YEAR} gezet op ${TARGET_LAST}.`);
    return;
  }

  if (mappings.length === 0) {
    throw new Error("Geen kandidaten gevonden; niets aangepast.");
  }

  if ((targetRows ?? []).length > 0) {
    throw new Error("Doelreeks is niet vrij; update afgebroken.");
  }

  for (const item of mappings) {
    const { error } = await supabase
      .from("inspections")
      .update({ inspection_number: item.newNumber })
      .eq("id", item.id)
      .eq("inspection_number", item.oldNumber);

    if (error) {
      throw new Error(`Update ${item.oldNumber} -> ${item.newNumber} mislukt: ${error.message}`);
    }
  }

  const lastAssigned = TARGET_START + mappings.length - 1;
  const nextLastNumber = lastAssigned;
  const { error: upsertError } = await supabase
    .from("inspection_sequences")
    .upsert(
      {
        sequence_year: TARGET_YEAR,
        last_number: nextLastNumber,
        updated_at: new Date().toISOString()
      },
      { onConflict: "sequence_year" }
    );

  if (upsertError) {
    throw new Error(`Sequence bijwerken mislukt: ${upsertError.message}`);
  }

  const { data: verifyRows, error: verifyError } = await supabase
    .from("inspections")
    .select("id, inspection_number, created_at")
    .in(
      "id",
      mappings.map((item) => item.id)
    )
    .order("inspection_number", { ascending: true });

  if (verifyError) {
    throw new Error(`Verificatie mislukt: ${verifyError.message}`);
  }

  const { data: verifySequence, error: verifySequenceError } = await supabase
    .from("inspection_sequences")
    .select("sequence_year, last_number, updated_at")
    .eq("sequence_year", TARGET_YEAR);

  if (verifySequenceError) {
    throw new Error(`Sequence-verificatie mislukt: ${verifySequenceError.message}`);
  }

  console.log("Aangepast:");
  console.table(verifyRows ?? []);
  console.log("Nieuwe sequence:", verifySequence ?? []);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
