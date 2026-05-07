"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireActivityActor } from "@/lib/auth";
import { addActivityLog, updatePlanningItem } from "@/lib/inspection-service";

function safeReturnTo(value: FormDataEntryValue | null) {
  const fallback = "/planning";
  const raw = String(value || "").trim();

  if (!raw.startsWith("/planning")) {
    return fallback;
  }

  return raw;
}

export async function updateNewAgendaPlanningItemAction(formData: FormData) {
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const dueDate = String(formData.get("dueDate") || "");
  const mode = String(formData.get("mode") || "") === "move" ? "move" : "schedule";
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const joiner = returnTo.includes("?") ? "&" : "?";

  if (!id || !dueDate) {
    redirect(`${returnTo}${joiner}error=Vul%20een%20geldige%20datum%20in` as Route);
  }

  await updatePlanningItem({ id, dueDate, mode });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.updated",
    entityType: "planning",
    entityId: id,
    targetLabel: `Planning ${dueDate}`,
    details: { ids: [id], mode, source: "nieuwe-agenda" }
  });

  revalidatePath("/planning/nieuwe-agenda");
  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/keuringen");
  redirect(`${returnTo}${joiner}${mode === "move" ? "moved" : "scheduled"}=1` as Route);
}

export async function createNewAgendaRouteAction(formData: FormData) {
  const actor = await requireActivityActor();
  const ids = JSON.parse(String(formData.get("ids") || "[]")) as string[];
  const routeTitle = String(formData.get("routeTitle") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const joiner = returnTo.includes("?") ? "&" : "?";
  const cleanIds = Array.from(new Set(ids.filter(Boolean)));

  if (!cleanIds.length || !routeTitle || !dueDate) {
    redirect(`${returnTo}${joiner}error=Kies%20resultaten,%20een%20routenaam%20en%20datum` as Route);
  }

  const routeNote = `Route: ${routeTitle}`;
  for (const id of cleanIds) {
    await updatePlanningItem({
      id,
      dueDate,
      mode: "schedule",
      notes: routeNote
    });
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.updated",
    entityType: "planning",
    targetLabel: `${routeTitle} ${dueDate}`,
    details: { ids: cleanIds, mode: "route", source: "nieuwe-agenda" }
  });

  revalidatePath("/planning/nieuwe-agenda");
  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/keuringen");
  redirect(`${returnTo}${joiner}scheduled=1` as Route);
}
