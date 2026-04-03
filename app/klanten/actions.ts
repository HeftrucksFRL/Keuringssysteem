"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCustomerContact,
  createCustomer,
  updateCustomer,
  updatePlanningItem
} from "@/lib/inspection-service";

export async function createCustomerAction(formData: FormData) {
  const id = await createCustomer({
    companyName: String(formData.get("companyName") || ""),
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  revalidatePath("/klanten");
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${id}?created=1`);
}

export async function updateCustomerAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  await updateCustomer({
    id,
    companyName: String(formData.get("companyName") || ""),
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${id}`);
  revalidatePath("/keuringen/nieuw");
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

export async function addCustomerContactAction(formData: FormData) {
  const customerId = String(formData.get("customerId") || "");

  await addCustomerContact({
    customerId,
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    makePrimary: formData.get("makePrimary") === "on"
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${customerId}?contactSaved=1`);
}
