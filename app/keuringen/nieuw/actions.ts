"use server";

import { redirect } from "next/navigation";
import { requireActivityActor } from "@/lib/auth";
import { getFormDefinition } from "@/lib/form-definitions";
import { addActivityLog, createInspection } from "@/lib/inspection-service";
import type { ChecklistOption, MachineType } from "@/lib/types";

export interface InspectionActionState {
  status: "idle" | "error";
  message?: string;
}

function parseChecklist(
  rawChecklist: string,
  machineType: MachineType
): Record<string, ChecklistOption> {
  const parsed = JSON.parse(rawChecklist) as Record<string, ChecklistOption>;
  const definition = getFormDefinition(machineType);
  const allowed = new Set(definition.checklistOptions);

  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => allowed.has(value))
  ) as Record<string, ChecklistOption>;
}

export async function submitInspectionAction(
  _prevState: InspectionActionState,
  formData: FormData
): Promise<InspectionActionState> {
  const actor = await requireActivityActor();
  const machineType = formData.get("machine_type");
  const checklist = formData.get("checklist");

  if (typeof machineType !== "string" || typeof checklist !== "string") {
    return {
      status: "error",
      message: "Het keuringstype of de checklist ontbreekt."
    };
  }

  const resultLabels = formData.getAll("result_labels").map(String);
  const inspectionDate = String(formData.get("inspection_date") || "");
  const machineNumber = String(formData.get("machine_number") || formData.get("internal_number") || "");
  const photos = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!String(formData.get("customer_name") || "").trim()) {
    return { status: "error", message: "Vul de klantnaam in." };
  }

  if (!inspectionDate) {
    return { status: "error", message: "Kies een keuringsdatum." };
  }

  if (!machineNumber.trim()) {
    return { status: "error", message: "Vul een uniek machinenummer in." };
  }

  const definition = getFormDefinition(machineType as MachineType);
  const machineDetails = Object.fromEntries(
    definition.machineFields
      .map((field) => [field.key, String(formData.get(field.key) || "")])
      .filter(([key]) => !key.startsWith("customer_"))
  );

  const inspection = await createInspection({
    machineType: machineType as MachineType,
    customer: {
      companyName: String(formData.get("customer_name") || ""),
      address: String(formData.get("customer_address") || ""),
      contactName: String(formData.get("customer_contact") || ""),
      phone: String(formData.get("customer_phone") || ""),
      email: String(formData.get("customer_email") || "")
    },
    machine: {
      machineNumber,
      brand: String(formData.get("brand") || formData.get("vehicle_brand") || ""),
      model: String(formData.get("model") || formData.get("vehicle_type") || ""),
      serialNumber: String(
        formData.get("serial_number") || formData.get("vehicle_serial_number") || ""
      ),
      buildYear: String(
        formData.get("build_year") || formData.get("vehicle_build_year") || ""
      ),
      internalNumber: String(formData.get("internal_number") || machineNumber),
      details: machineDetails
    },
    inspectionDate,
    checklist: parseChecklist(checklist, machineType as MachineType),
    findings: String(formData.get("findings") || ""),
    recommendations: String(formData.get("recommendations") || ""),
    conclusion: String(formData.get("conclusion") || ""),
    resultLabels,
    sendPdfToCustomer: formData.get("send_pdf_to_customer") === "on",
    photos: await Promise.all(
      photos.map(async (photo) => ({
        fileName: photo.name,
        contentType: photo.type,
        buffer: Buffer.from(await photo.arrayBuffer())
      }))
    )
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "inspection.created",
    entityType: "inspection",
    entityId: inspection.id,
    targetLabel: `Keuring ${inspection.inspectionNumber}`
  });

  redirect(`/keuringen?created=${inspection.inspectionNumber}`);
}
