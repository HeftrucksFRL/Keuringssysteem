"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveMachine,
  assignMachineToCustomer,
  createMachine,
  deleteMachine,
  updateMachine
} from "@/lib/inspection-service";

export async function createMachineAction(formData: FormData) {
  const id = await createMachine({
    customerId: String(formData.get("customerId") || ""),
    machineType: String(formData.get("machineType") || "heftruck_reachtruck") as Parameters<
      typeof createMachine
    >[0]["machineType"],
    brand: String(formData.get("brand") || ""),
    model: String(formData.get("model") || ""),
    serialNumber: String(formData.get("serialNumber") || ""),
    buildYear: String(formData.get("buildYear") || ""),
    internalNumber: String(formData.get("internalNumber") || "")
  });

  revalidatePath("/machines");
  revalidatePath("/klanten");
  revalidatePath("/keuringen/nieuw");
  redirect(`/machines/${id}?created=1`);
}

export async function updateMachineAction(formData: FormData) {
  const id = String(formData.get("id") || "");

  const affectedInspectionIds = await updateMachine({
    id,
    brand: String(formData.get("brand") || ""),
    model: String(formData.get("model") || ""),
    serialNumber: String(formData.get("serialNumber") || ""),
    buildYear: String(formData.get("buildYear") || ""),
    internalNumber: String(formData.get("internalNumber") || "")
  });

  revalidatePath("/machines");
  revalidatePath(`/machines/${id}`);
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  for (const inspectionId of affectedInspectionIds) {
    revalidatePath(`/keuringen/${inspectionId}`);
  }
  redirect(`/machines/${id}?saved=1`);
}

export async function assignMachineToCustomerAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  const customerId = String(formData.get("customerId") || "");

  const affectedInspectionIds = await assignMachineToCustomer({
    machineId,
    customerId
  });

  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/klanten");
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  for (const inspectionId of affectedInspectionIds) {
    revalidatePath(`/keuringen/${inspectionId}`);
  }

  redirect(`/machines/${machineId}?assigned=1`);
}

export async function archiveMachineAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  if (!machineId) {
    return;
  }

  await archiveMachine(machineId);
  revalidatePath("/machines");
  revalidatePath("/keuringen/nieuw");
  redirect("/machines?archived=1");
}

export async function deleteMachineAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  if (!machineId) {
    return;
  }

  try {
    await deleteMachine(machineId);
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Verwijderen is niet gelukt.");
    redirect(`/machines/${machineId}?error=${message}`);
  }

  revalidatePath("/machines");
  revalidatePath("/keuringen/nieuw");
  redirect("/machines?deleted=1");
}
