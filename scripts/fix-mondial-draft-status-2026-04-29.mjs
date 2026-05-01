import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const TARGET_DATE = "2026-04-29";
const CUSTOMER_NEEDLE = "mondial";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function loadEnv() {
  const raw = await fs.readFile(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function localDateRangeUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  return {
    startIso: new Date(Date.UTC(year, month - 1, day - 1, 22, 0, 0)).toISOString(),
    endIso: new Date(Date.UTC(year, month - 1, day, 21, 59, 59, 999)).toISOString()
  };
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

await loadEnv();

const apply = hasFlag("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { startIso, endIso } = localDateRangeUtc(TARGET_DATE);

const { data: customers, error: customerError } = await supabase
  .from("customers")
  .select("id, company_name")
  .ilike("company_name", `%${CUSTOMER_NEEDLE}%`);
if (customerError) throw customerError;

const customerIds = (customers ?? []).map((customer) => customer.id);

const { data: inspections, error: inspectionError } = await supabase
  .from("inspections")
  .select("id, inspection_number, customer_id, machine_id, machine_type, inspection_date, status, conclusion, findings, recommendations, created_at, updated_at, customer_snapshot, machine_snapshot")
  .gte("created_at", startIso)
  .lte("created_at", endIso)
  .order("created_at", { ascending: true });
if (inspectionError) throw inspectionError;

const matches = (inspections ?? []).filter((inspection) => {
  const snapshotName = clean(inspection.customer_snapshot?.customer_name).toLowerCase();
  return customerIds.includes(inspection.customer_id) || snapshotName.includes(CUSTOMER_NEEDLE);
});

console.table(
  matches.map((inspection) => ({
    id: inspection.id,
    number: inspection.inspection_number,
    status: inspection.status,
    customer: clean(inspection.customer_snapshot?.customer_name),
    machine: [inspection.machine_snapshot?.brand, inspection.machine_snapshot?.model, inspection.machine_snapshot?.serial_number]
      .filter(Boolean)
      .join(" "),
    conclusion: clean(inspection.conclusion),
    findings: clean(inspection.findings),
    recommendations: clean(inspection.recommendations),
    created: inspection.created_at
  }))
);

const toDraft = matches.filter((inspection) => inspection.status !== "draft");
console.log("Te wijzigen naar draft:", toDraft.map((inspection) => inspection.inspection_number));

if (apply && toDraft.length > 0) {
  const { error: updateError } = await supabase
    .from("inspections")
    .update({ status: "draft" })
    .in("id", toDraft.map((inspection) => inspection.id));
  if (updateError) throw updateError;
  console.log("Gewijzigd:", toDraft.length);
}
