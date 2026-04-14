"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActivityActor, requireUser } from "@/lib/auth";
import {
  addActivityLog,
  addAgendaEvent,
  createManualPlanningItem,
  deletePlanningItems,
  deleteAgendaEvent,
  updateAgendaEvent,
  updatePlanningItem,
  updateRental
} from "@/lib/inspection-service";

export async function createManualPlanningAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const machineId = String(formData.get("machineId") || "");
  const dueDate = String(formData.get("dueDate") || "");

  if (!customerId || !machineId || !dueDate) {
    redirect("/planning?error=Vul%20klant,%20machine%20en%20datum%20in");
  }

  await createManualPlanningItem({
    customerId,
    machineId,
    dueDate
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.created",
    entityType: "planning",
    targetLabel: `Handmatige planning ${dueDate}`,
    details: { customerId, machineId }
  });

  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/planning?month=${dueDate.slice(0, 7)}&planned=1`);
}

export async function updatePlanningItemAction(formData: FormData) {
  const actor = await requireActivityActor();
  const ids = JSON.parse(String(formData.get("ids") || "[]")) as string[];
  const dueDate = String(formData.get("dueDate") || "");
  const month = String(formData.get("month") || "");

  if (!ids.length || !dueDate) {
    redirect(`/planning?month=${month}&error=Vul%20een%20geldige%20datum%20in`);
  }

  for (const id of ids) {
    await updatePlanningItem({ id, dueDate });
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.updated",
    entityType: "planning",
    targetLabel: `Planning ${dueDate}`,
    details: { ids, month }
  });

  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/keuringen");
  redirect(`/planning?month=${month || dueDate.slice(0, 7)}&updated=1`);
}

export async function deletePlanningItemAction(formData: FormData) {
  const actor = await requireActivityActor();
  const ids = JSON.parse(String(formData.get("ids") || "[]")) as string[];
  const month = String(formData.get("month") || "");

  if (!ids.length) {
    redirect(`/planning?month=${month}&error=Planning%20niet%20gevonden`);
  }

  await deletePlanningItems({ ids });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.deleted",
    entityType: "planning",
    targetLabel: `Planning verwijderd`,
    details: { ids, month }
  });

  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/keuringen");
  redirect(`/planning?month=${month}&deleted=1`);
}

export async function updateRentalAction(formData: FormData) {
  const actor = await requireActivityActor();
  const rentalId = String(formData.get("rentalId") || "");
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const customerId = String(formData.get("customerId") || "");
  const price = String(formData.get("price") || "");
  const month = String(formData.get("month") || "");

  if (!rentalId || !startDate || !endDate) {
    redirect(`/planning?month=${month}&error=Vul%20een%20geldige%20periode%20in`);
  }

  if (endDate < startDate) {
    redirect(`/planning?month=${month}&error=De%20einddatum%20moet%20na%20de%20startdatum%20liggen`);
  }

  try {
    await updateRental({ rentalId, startDate, endDate, customerId: customerId || undefined, price });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Verhuur bijwerken is niet gelukt.");
    redirect(`/planning?month=${month || startDate.slice(0, 7)}&error=${message}`);
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "rental.updated",
    entityType: "rental",
    entityId: rentalId,
    targetLabel: `Verhuur ${startDate} - ${endDate}`,
    details: { customerId, price }
  });

  revalidatePath("/planning");
  revalidatePath("/verhuur");
  revalidatePath("/machines");
  revalidatePath("/klanten");
  redirect(`/planning?month=${month || startDate.slice(0, 7)}&updated=1`);
}

export async function createAgendaEventAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const eventDate = String(formData.get("eventDate") || "");

  if (!title || !eventDate) {
    redirect(`/planning?month=${eventDate.slice(0, 7)}&error=Vul%20een%20titel%20en%20datum%20in`);
  }

  await addAgendaEvent({
    ownerId: String(user?.id ?? "demo-user"),
    title,
    description,
    eventDate
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "agenda.created",
    entityType: "agenda",
    targetLabel: title,
    details: { eventDate }
  });

  revalidatePath("/planning");
  redirect(`/planning?month=${eventDate.slice(0, 7)}&appointment=1`);
}

export async function updateAgendaEventAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const eventDate = String(formData.get("eventDate") || "");
  const month = String(formData.get("month") || "");

  if (!id || !title || !eventDate) {
    redirect(`/planning?month=${month}&error=Vul%20een%20titel%20en%20datum%20in`);
  }

  await updateAgendaEvent({
    id,
    ownerId: String(user?.id ?? "demo-user"),
    title,
    description,
    eventDate
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "agenda.updated",
    entityType: "agenda",
    entityId: id,
    targetLabel: title,
    details: { eventDate }
  });

  revalidatePath("/planning");
  redirect(`/planning?month=${month || eventDate.slice(0, 7)}&updated=1`);
}

export async function deleteAgendaEventAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const month = String(formData.get("month") || "");

  if (!id) {
    redirect(`/planning?month=${month}&error=Afspraak%20niet%20gevonden`);
  }

  await deleteAgendaEvent({
    id,
    ownerId: String(user?.id ?? "demo-user")
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "agenda.deleted",
    entityType: "agenda",
    entityId: id,
    targetLabel: `Afspraak ${id}`
  });

  revalidatePath("/planning");
  redirect(`/planning?month=${month}&deleted=1`);
}
