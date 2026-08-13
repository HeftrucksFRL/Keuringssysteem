"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireActivityActor,
  requireCleanupManager,
  requireInspectionCustomerCorrectionManager
} from "@/lib/auth";
import {
  addActivityLog,
  addCustomerLocation,
  addCustomerContact,
  archiveCustomer,
  correctInspectionCustomer,
  createCustomer,
  deleteCustomer,
  deleteCustomerContact,
  deleteCustomerLocation,
  ensureRentalStockCustomerId,
  reassignMachineToCustomerForCleanup,
  restoreCustomer,
  updateCustomer,
  updateCustomerLocation,
  updateCustomerContact,
  updatePlanningItem
} from "@/lib/inspection-service";

function customerPathWithError(customerId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "De actie kon niet worden uitgevoerd.";
  return `/klanten/${customerId}?error=${encodeURIComponent(message)}` as Route;
}

export async function createCustomerAction(formData: FormData) {
  const actor = await requireActivityActor();
  const companyName = String(formData.get("companyName") || "");
  const id = await createCustomer({
    companyName,
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer.created",
    entityType: "customer",
    entityId: id,
    targetLabel: companyName || "Nieuwe klant"
  });

  revalidatePath("/klanten");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/");
  redirect(`/klanten/${id}?created=1`);
}

export async function updateCustomerAction(formData: FormData) {
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const companyName = String(formData.get("companyName") || "");
  await updateCustomer({
    id,
    companyName,
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    contactName: String(formData.get("contactName") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || "")
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer.updated",
    entityType: "customer",
    entityId: id,
    targetLabel: companyName || `Klant ${id}`
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${id}`);
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/");
  redirect(`/klanten/${id}?saved=1`);
}

export async function archiveCustomerAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");

  let customer;
  try {
    customer = await archiveCustomer(customerId);
  } catch (error) {
    redirect(customerPathWithError(customerId, error));
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer.archived",
    entityType: "customer",
    entityId: customerId,
    targetLabel: customer.companyName
  });

  revalidatePath("/klanten");
  revalidatePath("/klanten/archief");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  redirect("/klanten/archief?archived=1");
}

export async function restoreCustomerAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");

  let customer;
  try {
    customer = await restoreCustomer(customerId);
  } catch (error) {
    redirect(customerPathWithError(customerId, error));
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer.restored",
    entityType: "customer",
    entityId: customerId,
    targetLabel: customer.companyName
  });

  revalidatePath("/klanten");
  revalidatePath("/klanten/archief");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${customerId}?restored=1`);
}

export async function correctInspectionCustomerAction(formData: FormData) {
  const actor = await requireInspectionCustomerCorrectionManager();
  const sourceCustomerId = String(formData.get("sourceCustomerId") || "");
  const targetCustomerId = String(formData.get("customerId") || "");
  const inspectionId = String(formData.get("inspectionId") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!reason) {
    redirect(
      `/klanten/${sourceCustomerId}?error=${encodeURIComponent("Vul een reden voor de correctie in.")}`
    );
  }

  let result;
  try {
    result = await correctInspectionCustomer({
      inspectionId,
      sourceCustomerId,
      targetCustomerId
    });
  } catch (error) {
    redirect(customerPathWithError(sourceCustomerId, error));
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "inspection.customer_corrected",
    entityType: "inspection",
    entityId: inspectionId,
    targetLabel: `Keuring ${result.inspection.inspectionNumber}`,
    details: {
      sourceCustomerId,
      targetCustomerId,
      targetCustomerName: result.targetCustomer.companyName,
      reason
    }
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${sourceCustomerId}`);
  revalidatePath(`/klanten/${targetCustomerId}`);
  revalidatePath(`/keuringen/${inspectionId}`);
  revalidatePath("/keuringen");
  redirect(`/klanten/${sourceCustomerId}?inspectionCustomerCorrected=1`);
}

export async function movePlanningItemAction(formData: FormData) {
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const dueDate = String(formData.get("dueDate") || "");
  await updatePlanningItem({
    id,
    dueDate
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "planning.updated",
    entityType: "planning",
    entityId: id,
    targetLabel: `Vervolgkeuring ${dueDate}`
  });

  revalidatePath("/planning");
  revalidatePath("/");
}

export async function addCustomerContactAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const name = String(formData.get("name") || "");

  await addCustomerContact({
    customerId,
    name,
    department: String(formData.get("department") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    makePrimary: formData.get("makePrimary") === "on"
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_contact.created",
    entityType: "customer_contact",
    targetLabel: name || `Contactpersoon ${customerId}`,
    details: { customerId }
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/");
  redirect(`/klanten/${customerId}?contactSaved=1`);
}

export async function updateCustomerContactAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const contactId = String(formData.get("contactId") || "");
  const name = String(formData.get("name") || "");

  await updateCustomerContact({
    id: contactId,
    customerId,
    name,
    department: String(formData.get("department") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    makePrimary: formData.get("makePrimary") === "on"
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_contact.updated",
    entityType: "customer_contact",
    entityId: contactId,
    targetLabel: name || `Contactpersoon ${contactId}`,
    details: { customerId }
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/");
  redirect(`/klanten/${customerId}?contactSaved=1`);
}

export async function deleteCustomerContactAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const contactId = String(formData.get("contactId") || "");

  await deleteCustomerContact({
    id: contactId,
    customerId
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_contact.deleted",
    entityType: "customer_contact",
    entityId: contactId,
    targetLabel: `Contactpersoon ${contactId}`,
    details: { customerId }
  });

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/");
  redirect(`/klanten/${customerId}?contactSaved=1`);
}

export async function addCustomerLocationAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const name = String(formData.get("name") || "");

  await addCustomerLocation({
    customerId,
    name,
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    notes: String(formData.get("notes") || ""),
    makePrimary: formData.get("makePrimary") === "on"
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_location.created",
    entityType: "customer_location",
    targetLabel: name || `Locatie ${customerId}`,
    details: { customerId }
  });

  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/machines");
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${customerId}?locationSaved=1`);
}

export async function updateCustomerLocationAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const locationId = String(formData.get("locationId") || "");
  const name = String(formData.get("name") || "");

  await updateCustomerLocation({
    customerId,
    locationId,
    name,
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    notes: String(formData.get("notes") || ""),
    makePrimary: formData.get("makePrimary") === "on"
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_location.updated",
    entityType: "customer_location",
    entityId: locationId,
    targetLabel: name || `Locatie ${locationId}`,
    details: { customerId }
  });

  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/machines");
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${customerId}?locationSaved=1`);
}

export async function deleteCustomerLocationAction(formData: FormData) {
  const actor = await requireActivityActor();
  const customerId = String(formData.get("customerId") || "");
  const locationId = String(formData.get("locationId") || "");

  await deleteCustomerLocation({
    customerId,
    locationId
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer_location.deleted",
    entityType: "customer_location",
    entityId: locationId,
    targetLabel: `Locatie ${locationId}`,
    details: { customerId }
  });

  revalidatePath(`/klanten/${customerId}`);
  revalidatePath("/machines");
  revalidatePath("/keuringen/nieuw");
  redirect(`/klanten/${customerId}?locationSaved=1`);
}

export async function cleanupMoveMachineAction(formData: FormData) {
  const actor = await requireCleanupManager();
  const customerId = String(formData.get("customerId") || "");
  const machineId = String(formData.get("machineId") || "");
  const returnTo = String(formData.get("returnTo") || "").trim() || "/klanten";
  const moveToStock = String(formData.get("moveToStock") || "").trim() === "1";

  const targetCustomerId = moveToStock
    ? await ensureRentalStockCustomerId()
    : customerId;

  let affectedInspectionIds: string[] = [];

  try {
    affectedInspectionIds = await reassignMachineToCustomerForCleanup({
      machineId,
      customerId: targetCustomerId
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Machine verplaatsen is niet gelukt.");
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${message}` as Route
    );
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: moveToStock ? "machine.cleanup_stocked" : "machine.cleanup_reassigned",
    entityType: "machine",
    entityId: machineId,
    targetLabel: `Machine ${machineId}`,
    details: {
      customerId: targetCustomerId,
      moveToStock,
      syncedHistory: true
    }
  });

  revalidatePath("/klanten");
  revalidatePath("/machines");
  revalidatePath("/planning");
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/verhuur");
  revalidatePath("/");
  revalidatePath(returnTo.split("?")[0] || "/klanten");
  for (const inspectionId of affectedInspectionIds) {
    revalidatePath(`/keuringen/${inspectionId}`);
  }

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}cleanupMoved=1` as Route);
}

export async function deleteCustomerAction(formData: FormData) {
  const actor = await requireCleanupManager();
  const customerId = String(formData.get("customerId") || "");

  let deletedCustomerName = "";

  try {
    const deletedCustomer = await deleteCustomer(customerId);
    deletedCustomerName = deletedCustomer?.companyName || `Klant ${customerId}`;
  } catch (error) {
    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : encodeURIComponent("Klant verwijderen is niet gelukt.");
    redirect(`/klanten/${customerId}?error=${message}`);
  }

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "customer.deleted",
    entityType: "customer",
    entityId: customerId,
    targetLabel: deletedCustomerName
  });

  revalidatePath("/klanten");
  revalidatePath("/machines");
  revalidatePath("/planning");
  revalidatePath("/keuringen");
  revalidatePath("/keuringen/nieuw");
  revalidatePath("/verhuur");
  revalidatePath("/");
  redirect("/klanten?deleted=1");
}
