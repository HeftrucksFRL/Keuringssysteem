import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function listAllStoragePaths(bucketApi, prefix = "") {
  const entries = [];
  let offset = 0;

  while (true) {
    const { data, error } = await bucketApi.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      throw new Error(`Opslaglijst ophalen mislukt voor '${prefix}': ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      if (!item?.name) continue;
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        entries.push(...(await listAllStoragePaths(bucketApi, itemPath)));
      } else {
        entries.push(itemPath);
      }
    }

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return entries;
}

async function purgeStorage(supabase, bucketName) {
  const bucketApi = supabase.storage.from(bucketName);
  const paths = await listAllStoragePaths(bucketApi);

  for (const group of chunk(paths, 100)) {
    if (group.length === 0) continue;
    const { error } = await bucketApi.remove(group);
    if (error) {
      throw new Error(`Opslag opschonen mislukt in bucket '${bucketName}': ${error.message}`);
    }
  }

  return paths.length;
}

async function purgeTableByKey(supabase, table, keyColumn) {
  let deleted = 0;

  while (true) {
    const { data, error } = await supabase.from(table).select(keyColumn).limit(500);
    if (error) {
      throw new Error(`Sleutels ophalen mislukt voor ${table}: ${error.message}`);
    }

    const keys = (data ?? []).map((row) => row[keyColumn]).filter((value) => value != null);
    if (keys.length === 0) {
      break;
    }

    const { error: deleteError } = await supabase.from(table).delete().in(keyColumn, keys);
    if (deleteError) {
      throw new Error(`Leegmaken mislukt voor ${table}: ${deleteError.message}`);
    }

    deleted += keys.length;
  }

  return deleted;
}

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const storageDeleted = await purgeStorage(supabase, "inspection-files");

  const summary = {
    storageDeleted,
    inspection_attachments: await purgeTableByKey(supabase, "inspection_attachments", "id"),
    mail_events: await purgeTableByKey(supabase, "mail_events", "id"),
    planning_items: await purgeTableByKey(supabase, "planning_items", "id"),
    rentals: await purgeTableByKey(supabase, "rentals", "id"),
    inspections: await purgeTableByKey(supabase, "inspections", "id"),
    machines: await purgeTableByKey(supabase, "machines", "id"),
    customer_contacts: await purgeTableByKey(supabase, "customer_contacts", "id"),
    customers: await purgeTableByKey(supabase, "customers", "id"),
    activity_logs: await purgeTableByKey(supabase, "activity_logs", "id"),
    todo_items: await purgeTableByKey(supabase, "todo_items", "id"),
    agenda_events: await purgeTableByKey(supabase, "agenda_events", "id"),
    inspection_sequences: await purgeTableByKey(supabase, "inspection_sequences", "sequence_year")
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
