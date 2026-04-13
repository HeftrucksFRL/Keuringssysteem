"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActivityActor } from "@/lib/auth";
import { addActivityLog, resendInspectionMail, updateInspection } from "@/lib/inspection-service";

export async function resendInspectionMailAction(formData: FormData) {
  const actor = await requireActivityActor();
  const inspectionId = String(formData.get("inspection_id") || "");
  if (!inspectionId) {
    return;
  }

  await resendInspectionMail(inspectionId);
  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "inspection.resent",
    entityType: "inspection",
    entityId: inspectionId,
    targetLabel: `Keuring ${inspectionId}`
  });
  revalidatePath("/keuringen");
  revalidatePath(`/keuringen/${inspectionId}`);
  revalidatePath("/");
}

export async function updateInspectionAction(formData: FormData) {
  const actor = await requireActivityActor();
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

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "inspection.updated",
    entityType: "inspection",
    entityId: id,
    targetLabel: `Keuring ${id}`
  });

  revalidatePath("/keuringen");
  revalidatePath(`/keuringen/${id}`);
  revalidatePath("/");
  redirect(`/keuringen/${id}?saved=1`);
}
