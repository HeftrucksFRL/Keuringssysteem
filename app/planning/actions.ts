"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  addAgendaEvent,
  createManualPlanningItem,
  deleteAgendaEvent,
  updateAgendaEvent,
  updatePlanningItem,
  updateRental
} from "@/lib/inspection-service";

export async function createManualPlanningAction(formData: FormData) {
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

  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/planning?month=${dueDate.slice(0, 7)}&planned=1`);
}

export async function updatePlanningItemAction(formData: FormData) {
  const ids = JSON.parse(String(formData.get("ids") || "[]")) as string[];
  const dueDate = String(formData.get("dueDate") || "");
  const month = String(formData.get("month") || "");

  if (!ids.length || !dueDate) {
    redirect(`/planning?month=${month}&error=Vul%20een%20geldige%20datum%20in`);
  }

  for (const id of ids) {
    await updatePlanningItem({ id, dueDate });
  }

  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/keuringen");
  redirect(`/planning?month=${month || dueDate.slice(0, 7)}&updated=1`);
}

export async function updateRentalAction(formData: FormData) {
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

  await updateRental({ rentalId, startDate, endDate, customerId: customerId || undefined, price });

  revalidatePath("/planning");
  revalidatePath("/verhuur");
  revalidatePath("/machines");
  revalidatePath("/klanten");
  redirect(`/planning?month=${month || startDate.slice(0, 7)}&updated=1`);
}

export async function createAgendaEventAction(formData: FormData) {
  const user = await requireUser();
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

  revalidatePath("/planning");
  redirect(`/planning?month=${eventDate.slice(0, 7)}&appointment=1`);
}

export async function updateAgendaEventAction(formData: FormData) {
  const user = await requireUser();
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

  revalidatePath("/planning");
  redirect(`/planning?month=${month || eventDate.slice(0, 7)}&updated=1`);
}

export async function deleteAgendaEventAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const month = String(formData.get("month") || "");

  if (!id) {
    redirect(`/planning?month=${month}&error=Afspraak%20niet%20gevonden`);
  }

  await deleteAgendaEvent({
    id,
    ownerId: String(user?.id ?? "demo-user")
  });

  revalidatePath("/planning");
  redirect(`/planning?month=${month}&deleted=1`);
}
