"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveMachine,
  assignMachineToCustomer,
  createMachine,
  ensureRentalStockCustomerId,
  getMachineArchiveLockDate,
  getMachineById,
  isMachineArchived,
  updateMachine
} from "@/lib/inspection-service";
import { getFormDefinition } from "@/lib/form-definitions";
import type { MachineType } from "@/lib/types";

function getMachinePayload(formData: FormData, machineType: MachineType) {
  const definition = getFormDefinition(machineType);
  const fieldValues = Object.fromEntries(
    definition.machineFields
      .filter(
        (field) =>
          !field.key.startsWith("customer_") &&
          field.key !== "inspection_date" &&
          field.key !== "machine_number"
      )
      .map((field) => [field.key, String(formData.get(field.key) || "")])
  );

  const brand =
    fieldValues.brand ||
    fieldValues.vehicle_brand ||
    String(formData.get("brand") || "");
  const model =
    fieldValues.model ||
    fieldValues.vehicle_type ||
    String(formData.get("model") || "");
  const serialNumber =
    fieldValues.serial_number ||
    fieldValues.vehicle_serial_number ||
    String(formData.get("serialNumber") || "");
  const buildYear =
    fieldValues.build_year ||
    fieldValues.vehicle_build_year ||
    String(formData.get("buildYear") || "");
  const internalNumber =
    fieldValues.internal_number ||
    fieldValues.vehicle_internal_number ||
    String(formData.get("internalNumber") || "");

  const details = Object.fromEntries(
    Object.entries(fieldValues).filter(
      ([key, value]) =>
        !["brand", "model", "serial_number", "build_year", "internal_number"].includes(key) &&
        value.trim()
    )
  );

  return {
    brand,
    model,
    serialNumber,
    buildYear,
    internalNumber,
    details
  };
}

export async function createMachineAction(formData: FormData) {
  const toStock = String(formData.get("toStock") || "") === "1";
  const customerId = toStock
    ? await ensureRentalStockCustomerId()
    : String(formData.get("customerId") || "");
  const machineType = String(formData.get("machineType") || "heftruck_reachtruck") as MachineType;
  const payload = getMachinePayload(formData, machineType);

  const id = await createMachine({
    customerId,
    machineType,
    brand: payload.brand,
    model: payload.model,
    serialNumber: payload.serialNumber,
    buildYear: payload.buildYear,
    internalNumber: payload.internalNumber,
    details: payload.details
  });

  revalidatePath("/machines");
  revalidatePath("/klanten");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/verhuur");
  redirect(`/machines/${id}?created=1`);
}

export async function updateMachineAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const machineType = String(formData.get("machineType") || "heftruck_reachtruck") as MachineType;
  const payload = getMachinePayload(formData, machineType);

  let affectedInspectionIds: string[] = [];

  try {
    affectedInspectionIds = await updateMachine({
      id,
      machineType,
      brand: payload.brand,
      model: payload.model,
      serialNumber: payload.serialNumber,
      buildYear: payload.buildYear,
      internalNumber: payload.internalNumber,
      details: payload.details
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

export async function unarchiveMachineAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  if (!machineId) {
    return;
  }

  const machine = await getMachineById(machineId, { includeArchived: true });
  if (!machine || !isMachineArchived(machine)) {
    redirect(`/machines/${machineId}`);
  }

  if (getMachineArchiveLockDate(machine)?.getTime() ?? 0 <= Date.now()) {
    redirect(`/machines/${machineId}?error=${encodeURIComponent("Archiveren ongedaan maken is alleen binnen 7 dagen mogelijk.")}`);
  }

  const clearedDetails = Object.fromEntries(
    Object.entries(machine.configuration).filter(([key]) => key !== "__archivedAt")
  );

  await updateMachine({
    id: machine.id,
    machineType: machine.machineType,
    brand: machine.brand,
    model: machine.model,
    serialNumber: machine.serialNumber,
    buildYear: machine.buildYear,
    internalNumber: machine.internalNumber,
    details: clearedDetails
  });

  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/klanten");
  revalidatePath("/verhuur");
  redirect(`/machines/${machineId}?unarchived=1`);
}
