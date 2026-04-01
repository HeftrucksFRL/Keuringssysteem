"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createManualPlanningItem } from "@/lib/inspection-service";

export async function createManualPlanningAction(formData: FormData) {
  const customerId = String(formData.get("customerId") || "");
  const machineId = String(formData.get("machineId") || "");
  const dueDate = String(formData.get("dueDate") || "");

  if (!customerId || !machineId || !dueDate) {
    redirect("/planning?error=Vul%20klant,%20machine%20en%20datum%20in");
  }

  await createManualPlanningItem({
    customerId,
    machineId,
    dueDate
  });

  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/planning?month=${dueDate.slice(0, 7)}&planned=1`);
}
