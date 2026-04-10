"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveMachine,
  assignMachineToCustomer,
  createMachine,
  updateMachine
} from "@/lib/inspection-service";
import { getFormDefinition } from "@/lib/form-definitions";

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
  revalidatePath("/verhuur");
  redirect(`/machines/${id}?created=1`);
}

export async function updateMachineAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const machineType = String(formData.get("machineType") || "heftruck_reachtruck") as Parameters<
    typeof updateMachine
  >[0]["machineType"];
  const definition = getFormDefinition(machineType);
  const extraDetails = Object.fromEntries(
    definition.machineFields
      .filter(
        (field) =>
          !field.key.startsWith("customer_") &&
          !["brand", "model", "build_year", "internal_number", "serial_number", "inspection_date", "sticker_number", "machine_number"].includes(field.key)
      )
      .map((field) => [field.key, String(formData.get(field.key) || "")])
      .filter(([, value]) => value.trim())
  );

  let affectedInspectionIds: string[] = [];

  try {
    affectedInspectionIds = await updateMachine({
      id,
      machineType,
      brand: String(formData.get("brand") || ""),
      model: String(formData.get("model") || ""),
      serialNumber: String(formData.get("serialNumber") || ""),
      buildYear: String(formData.get("buildYear") || ""),
      internalNumber: String(formData.get("internalNumber") || ""),
      details: extraDetails
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Machine opslaan is niet gelukt.");
    redirect(`/machines/${id}?error=${message}`);
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${id}`);
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/verhuur");
  for (const inspectionId of affectedInspectionIds) {
    revalidatePath(`/keuringen/${inspectionId}`);
  }
  redirect(`/machines/${id}?saved=1`);
}

export async function assignMachineToCustomerAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  const customerId = String(formData.get("customerId") || "");

  let affectedInspectionIds: string[] = [];

  try {
    affectedInspectionIds = await assignMachineToCustomer({
      machineId,
      customerId
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Machine koppelen is niet gelukt.");
    redirect(`/machines/${machineId}?error=${message}`);
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/klanten");
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/verhuur");
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
  revalidatePath("/verhuur");
  redirect("/machines?archived=1");
}
