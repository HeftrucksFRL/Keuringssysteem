"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateCustomer, updatePlanningItem } from "@/lib/inspection-service";

export async function updateCustomerAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  await updateCustomer({
    id,
    companyName: String(formData.get("companyName") || ""),
    address: String(formData.get("address") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${id}`);
  redirect(`/klanten/${id}?saved=1`);
}

export async function movePlanningItemAction(formData: FormData) {
  await updatePlanningItem({
    id: String(formData.get("id") || ""),
    dueDate: String(formData.get("dueDate") || "")
  });

  revalidatePath("/planning");
  revalidatePath("/");
}
