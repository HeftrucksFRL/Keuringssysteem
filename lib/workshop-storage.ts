import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkshopState } from "./workshop";
import { normalizeWorkshopTransports } from "./workshop-transport";

export class WorkshopConflict extends Error {}

// Object key order must not make two identical database records appear different.
export function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameRecord(v, b[i]));
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(k => left[k] !== undefined);
  return keys.length === Object.keys(right).filter(k => right[k] !== undefined).length && keys.every(k => sameRecord(left[k], right[k]));
}

function mergeRows<T extends { id: string }>(base: T[], next: T[], current: T[], label: string): T[] {
  const result = new Map(current.map(row => [row.id, row]));
  const old = new Map(base.map(row => [row.id, row]));
  const incoming = new Map(next.map(row => [row.id, row]));
  for (const id of new Set([...old.keys(), ...incoming.keys()])) {
    const before = old.get(id), after = incoming.get(id), latest = result.get(id);
    if (sameRecord(before, after)) continue;
    if (!sameRecord(before, latest) && !sameRecord(after, latest)) throw new WorkshopConflict(`${label} is intussen door een collega gewijzigd. Open de nieuwste versie.`);
    if (after) result.set(id, {...after}); else result.delete(id);
  }
  return [...result.values()];
}

export function mergeWorkshopChanges(base: WorkshopState, next: WorkshopState, current: WorkshopState): WorkshopState {
  const b = normalizeWorkshopTransports(base), n = normalizeWorkshopTransports(next), c = normalizeWorkshopTransports(current);
  // Employee order is meaningful, so changes to this shared list are kept atomic.
  const employeesChanged = !sameRecord(b.employees, n.employees);
  if (employeesChanged && !sameRecord(b.employees, c.employees) && !sameRecord(n.employees, c.employees)) throw new WorkshopConflict("De medewerkerslijst is intussen gewijzigd.");
  const jobs = mergeRows(b.jobs, n.jobs, c.jobs, "Deze werkbon");
  // Concurrent new orders receive an available number without changing existing IDs.
  const existingIds = new Set(c.jobs.map(j => j.id)), used = new Set(c.jobs.map(j => j.number));
  let number = Math.max(c.nextJobNumber || 1, ...c.jobs.map(j => Number(j.number.slice(3)) + 1));
  for (const job of jobs) if (!existingIds.has(job.id)) {
    if (used.has(job.number)) job.number = `WB-${String(number++).padStart(4, "0")}`;
    used.add(job.number);
  }
  return {...c, employees: employeesChanged ? n.employees : c.employees, jobs,
    transports: mergeRows(b.transports || [], n.transports || [], c.transports || [], "Deze transportbon")};
}

export async function readWorkshopState(client: SupabaseClient) {
  const result = await client.from("workshop_state").select("state,version").eq("id", 1).single();
  if (result.error || !result.data) throw new Error("Werkplaatsopslag niet beschikbaar. Installeer supabase/workshop-relational.sql.");
  return {state: normalizeWorkshopTransports(result.data.state as WorkshopState), version: Number(result.data.version)};
}

export async function saveWorkshopState(client: SupabaseClient, previous: WorkshopState, next: WorkshopState, actor: string,
  machineChanges: {machineId: string; expectedCustomerId: string; customerId?: string; hourReading?: string; expectedHourReading?: string}[] = []) {
  const result = await client.rpc("save_workshop_changes", {p_previous: previous, p_next: next, p_actor: actor || null, p_machine_changes: machineChanges});
  if (result.error) {
    if (["40001", "23505"].includes(result.error.code)) throw new WorkshopConflict("Deze bon of machine is intussen gewijzigd. Vernieuw en probeer opnieuw.");
    if (result.error.code === "P0001") throw new Error(result.error.message);
    throw new Error("Werkbon opslaan mislukt. Er zijn geen gedeeltelijke wijzigingen opgeslagen.");
  }
  // Return the committed state from the transaction, not the browser's stale copy.
  return result.data as {state: WorkshopState; version: number};
}
