import { NextResponse, type NextRequest } from "next/server";
import { getFormDefinition } from "@/lib/form-definitions";
import { requireActivityActor } from "@/lib/auth";
import { addActivityLog, createInspection, updateInspectionFromForm } from "@/lib/inspection-service";
import { applyRateLimit, validateCsrf, validateOrigin } from "@/lib/security";
import type { ChecklistOption, MachineType } from "@/lib/types";

function buildMachineDossier(serialNumber: string, internalNumber: string) {
  const serial = serialNumber.trim();
  const internal = internalNumber.trim();

  if (serial && internal) {
    return `${serial}-${internal}`;
  }

  return serial || internal;
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

export async function POST(request: NextRequest) {
  try {
    const originError = validateOrigin(request);
    if (originError) {
      return NextResponse.json({ ok: false, message: originError }, { status: 403 });
    }

    const csrfError = validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ ok: false, message: csrfError }, { status: 403 });
    }

    const rateLimitError = applyRateLimit(request, "inspection-save", 30);
    if (rateLimitError) {
      return NextResponse.json({ ok: false, message: rateLimitError }, { status: 429 });
    }

    const formData = await request.formData();
    const honeypot = String(formData.get("website") || "").trim();
    if (honeypot) {
      return NextResponse.json(
        { ok: false, message: "Opslaan is niet gelukt. Probeer het opnieuw." },
        { status: 400 }
      );
    }

    const machineType = String(formData.get("machine_type") || "") as MachineType;
    const checklist = String(formData.get("checklist") || "");
    const existingCustomerId = String(formData.get("existing_customer_id") || "").trim();
    const existingMachineId = String(formData.get("existing_machine_id") || "").trim();
    const internalNumber = String(formData.get("internal_number") || "");
    const serialNumber = String(
      formData.get("serial_number") || formData.get("vehicle_serial_number") || ""
    );
    const inspectionDate = String(formData.get("inspection_date") || "");
    const inspectionId = String(formData.get("inspection_id") || "").trim();
    const linkedBatteryMachineId = String(formData.get("linked_battery_machine_id") || "").trim();

    if (!machineType || !checklist) {
      return NextResponse.json(
        { ok: false, message: "De keuring kon niet worden verwerkt." },
        { status: 400 }
      );
    }

    if (!String(formData.get("customer_name") || "").trim()) {
      return NextResponse.json(
        { ok: false, message: "Vul eerst de klant in." },
        { status: 400 }
      );
    }

    if (!internalNumber.trim()) {
      return NextResponse.json(
        { ok: false, message: "Vul het intern nummer van de machine in." },
        { status: 400 }
      );
    }

    const photos = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    const definition = getFormDefinition(machineType);
    const machineDetails = Object.fromEntries(
      definition.machineFields
        .map((field) => [field.key, String(formData.get(field.key) || "")])
        .filter(([key]) => !key.startsWith("customer_"))
    );

    const payload = {
      customerId: existingCustomerId || undefined,
      machineId: existingMachineId || undefined,
      linkedBatteryMachineId: linkedBatteryMachineId || undefined,
      machineType,
      customer: {
        companyName: String(formData.get("customer_name") || ""),
        address: String(formData.get("customer_address") || ""),
        contactName: String(formData.get("customer_contact") || ""),
        contactDepartment: String(formData.get("customer_contact_department") || ""),
        phone: String(formData.get("customer_phone") || ""),
        email: String(formData.get("customer_email") || ""),
        contactId: String(formData.get("selected_contact_id") || "").trim() || undefined,
        saveAsNewContact: String(formData.get("save_as_new_contact") || "").trim() === "1"
      },
      machine: {
        machineNumber: buildMachineDossier(serialNumber, internalNumber),
        brand: String(formData.get("brand") || formData.get("vehicle_brand") || ""),
        model: String(formData.get("model") || formData.get("vehicle_type") || ""),
        serialNumber,
        buildYear: String(
          formData.get("build_year") || formData.get("vehicle_build_year") || ""
        ),
        internalNumber,
        details: machineDetails
      },
      inspectionDate,
      checklist: parseChecklist(checklist, machineType),
      findings: String(formData.get("findings") || ""),
      recommendations: String(formData.get("recommendations") || ""),
      conclusion: String(formData.get("conclusion") || ""),
      resultLabels: formData.getAll("result_labels").map(String),
      sendPdfToCustomer: formData.get("send_pdf_to_customer") === "on",
      photos: await Promise.all(
        photos.map(async (photo) => ({
          fileName: photo.name,
          contentType: photo.type,
          buffer: Buffer.from(await photo.arrayBuffer())
        }))
      )
    };

    const inspection = inspectionId
      ? await updateInspectionFromForm(inspectionId, payload)
      : await createInspection(payload);

    const actor = await requireActivityActor();
    await addActivityLog({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: inspectionId ? "inspection.updated" : "inspection.created",
      entityType: "inspection",
      entityId: inspection.id,
      targetLabel: `Keuring ${inspection.inspectionNumber}`,
      details: {
        customerId: inspection.customerId,
        machineId: inspection.machineId,
        status: inspection.status
      }
    });

    return NextResponse.json({
      ok: true,
      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      status: inspection.status
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Opslaan is niet gelukt. Probeer het opnieuw."
      },
      { status: 500 }
    );
  }
}
