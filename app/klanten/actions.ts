"use server";

import { revalidatePath } from "next/cache";
import { updateCustomer, updatePlanningItem } from "@/lib/inspection-service";

export async function updateCustomerAction(formData: FormData) {
  await updateCustomer({
    id: String(formData.get("id") || ""),
    companyName: String(formData.get("companyName") || ""),
    address: String(formData.get("address") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${String(formData.get("id") || "")}`);
}

export async function movePlanningItemAction(formData: FormData) {
  await updatePlanningItem({
    id: String(formData.get("id") || ""),
    dueDate: String(formData.get("dueDate") || "")
  });

  revalidatePath("/planning");
  revalidatePath("/");
}
