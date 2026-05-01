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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await supabase
  .from("activity_logs")
  .select("actor_name, actor_email, action, entity_type, created_at")
  .order("created_at", { ascending: false })
  .limit(1000);

if (error) throw error;

const actors = new Map();
for (const row of data ?? []) {
  const key = `${row.actor_name ?? ""} <${row.actor_email ?? ""}>`;
  const current = actors.get(key) ?? {
    count: 0,
    latest: row.created_at,
    actions: new Set(),
    entities: new Set()
  };
  current.count += 1;
  current.actions.add(row.action);
  current.entities.add(row.entity_type);
  actors.set(key, current);
}

console.table(
  [...actors].map(([actor, value]) => ({
    actor,
    count: value.count,
    latest: value.latest,
    actions: [...value.actions].join(" | "),
    entities: [...value.entities].join(" | ")
  }))
);
