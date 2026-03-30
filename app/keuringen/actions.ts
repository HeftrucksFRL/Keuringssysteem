"use server";

import { revalidatePath } from "next/cache";
import { resendInspectionMail } from "@/lib/inspection-service";

export async function resendInspectionMailAction(formData: FormData) {
  const inspectionId = String(formData.get("inspection_id") || "");
  if (!inspectionId) {
    return;
  }

  await resendInspectionMail(inspectionId);
  revalidatePath("/keuringen");
  revalidatePath(`/keuringen/${inspectionId}`);
}
