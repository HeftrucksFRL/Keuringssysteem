"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import {
  archiveMachine,
  assignMachineToCustomer,
  createMachine,
  ensureRentalStockCustomerId,
  getMachineArchiveLockDate,
  getMachineById,
  isMachineArchived,
  setBatteryChargerLink,
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
    fieldValues.battery_brand ||
    fieldValues.charger_brand ||
    fieldValues.vehicle_brand ||
    String(formData.get("brand") || "");
  const model =
    fieldValues.model ||
    fieldValues.battery_type ||
    fieldValues.charger_type ||
    fieldValues.vehicle_type ||
    String(formData.get("model") || "");
  const serialNumber =
    fieldValues.serial_number ||
    fieldValues.battery_serial_number ||
    fieldValues.charger_serial_number ||
    fieldValues.vehicle_serial_number ||
    String(formData.get("serialNumber") || "");
  const buildYear =
    fieldValues.build_year ||
    fieldValues.vehicle_build_year ||
    String(formData.get("buildYear") || "");
  const internalNumber =
    fieldValues.internal_number ||
    fieldValues.battery_internal_number ||
    fieldValues.charger_internal_number ||
    fieldValues.vehicle_internal_number ||
    String(formData.get("internalNumber") || "");

  const details = Object.fromEntries(
    Object.entries(fieldValues).filter(
      ([key, value]) =>
        !["brand", "model", "serial_number", "build_year", "internal_number"].includes(key) &&
        value.trim()
    )
  );

  const linkedMachineId = String(formData.get("linked_machine_id") || "").trim();
  if (machineType === "batterij_lader" && linkedMachineId) {
    details.linked_machine_id = linkedMachineId;
  }

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
  const machineType = String(formData.get("machineType") || "heftruck_reachtruck") as MachineType;
  const payload = getMachinePayload(formData, machineType);
  const linkedMachineId = String(formData.get("linked_machine_id") || "").trim();
  const linkedMachine =
    linkedMachineId ? await getMachineById(linkedMachineId, { includeArchived: true }) : null;
  const customerId = toStock
    ? await ensureRentalStockCustomerId()
    : machineType === "batterij_lader"
      ? linkedMachine?.customerId || (await ensureRentalStockCustomerId())
      : String(formData.get("customerId") || "");

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

export async function assignMachineToStockAction(formData: FormData) {
  const machineId = String(formData.get("machineId") || "");
  if (!machineId) {
    return;
  }

  const stockCustomerId = await ensureRentalStockCustomerId();

  let affectedInspectionIds: string[] = [];

  try {
    affectedInspectionIds = await assignMachineToCustomer({
      machineId,
      customerId: stockCustomerId
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Machine terugzetten naar voorraad is niet gelukt.");
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

  redirect(`/machines/${machineId}?detached=1`);
}

export async function saveBatteryChargerLinkAction(formData: FormData) {
  const batteryMachineId = String(formData.get("batteryMachineId") || "");
  const removeLink = String(formData.get("remove_link") || "").trim() === "1";
  const linkedMachineId = removeLink ? "" : String(formData.get("linked_machine_id") || "").trim();
  const redirectTo =
    String(formData.get("redirectTo") || "").trim() || `/machines/${batteryMachineId}`;

  if (!batteryMachineId) {
    redirect(redirectTo as Route);
  }

  try {
    await setBatteryChargerLink({
      batteryMachineId,
      linkedMachineId: linkedMachineId || undefined
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Batterij / lader koppelen is niet gelukt.");
    redirect(
      `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${message}` as Route
    );
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${batteryMachineId}`);
  if (linkedMachineId) {
    revalidatePath(`/machines/${linkedMachineId}`);
  }
  revalidatePath("/klanten");
  revalidatePath("/keuringen/nieuw");

  redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${linkedMachineId ? "batteryLinked=1" : "batteryUnlinked=1"}` as Route
  );
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
