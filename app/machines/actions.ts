"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assignMachineToCustomer,
  createMachine,
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
  for (const inspectionId of affectedInspectionIds) {
    revalidatePath(`/keuringen/${inspectionId}`);
  }

  redirect(`/machines/${machineId}?assigned=1`);
}
