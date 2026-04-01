"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeRental, createRental } from "@/lib/inspection-service";

export async function createRentalAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  const customerId = String(formData.get("customerId") || "");
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const price = String(formData.get("price") || "");

  if (!machineId || !customerId || !startDate || !endDate) {
    redirect(`/machines/${machineId}?error=Vul%20klant,%20startdatum%20en%20einddatum%20in`);
  }

  if (endDate < startDate) {
    redirect(`/machines/${machineId}?error=De%20einddatum%20moet%20na%20de%20startdatum%20liggen`);
  }

  try {
    await createRental({
      machineId,
      customerId,
      startDate,
      endDate,
      price
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Verhuur starten is niet gelukt.");
    redirect(`/machines/${machineId}?error=${message}`);
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/planning");
  revalidatePath("/verhuur");
  redirect(`/machines/${machineId}?rented=1`);
}

export async function completeRentalAction(formData: FormData) {
  const rentalId = String(formData.get("rentalId") || "");
  const machineId = String(formData.get("machineId") || "");

  if (!rentalId || !machineId) {
    return;
  }

  await completeRental(rentalId);
  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/planning");
  revalidatePath("/verhuur");
  redirect(`/machines/${machineId}?returned=1`);
}
