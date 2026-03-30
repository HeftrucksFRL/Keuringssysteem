"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resendInspectionMail, updateInspection } from "@/lib/inspection-service";

export async function resendInspectionMailAction(formData: FormData) {
  const inspectionId = String(formData.get("inspection_id") || "");
  if (!inspectionId) {
    return;
  }

  await resendInspectionMail(inspectionId);
  revalidatePath("/keuringen");
  revalidatePath(`/keuringen/${inspectionId}`);
}

export async function updateInspectionAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) {
    return;
  }

  await updateInspection({
    id,
    inspectionDate: String(formData.get("inspectionDate") || ""),
    findings: String(formData.get("findings") || ""),
    recommendations: String(formData.get("recommendations") || ""),
    conclusion: String(formData.get("conclusion") || ""),
    status: String(formData.get("status") || "approved") as
      | "draft"
      | "completed"
      | "approved"
      | "rejected",
    sendPdfToCustomer: formData.get("sendPdfToCustomer") === "on"
  });

  revalidatePath("/keuringen");
  revalidatePath(`/keuringen/${id}`);
  redirect(`/keuringen/${id}?saved=1`);
}
