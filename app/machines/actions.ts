"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateMachine } from "@/lib/inspection-service";

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
