import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildCustomerMail, buildInternalMail } from "@/lib/mail";
import { sendInspectionEmails } from "@/lib/mailer";
import { storeInspectionPhoto } from "@/lib/attachments";
import { appConfig, hasSupabaseConfig } from "@/lib/env";
import { demoData } from "@/lib/demo-data";
import { readAppData, writeAppData } from "@/lib/file-store";
import { addTwelveMonths } from "@/lib/utils";
import { generateInspectionDocuments } from "@/lib/documents";
import { getYearSequenceStart } from "@/lib/inspection-number";
import type {
  AppDataSnapshot,
  CreateInspectionInput,
  CustomerRecord,
  InspectionRecord,
  MachineRecord,
  PlanningRecord,
  RentalRecord
} from "@/lib/domain";

function nowIso() {
  return new Date().toISOString();
}

const reservedMachineKeys = new Set([
  "machine_number",
  "brand",
  "model",
  "serial_number",
  "build_year",
  "internal_number",
  "inspection_date"
]);

function sanitizeMachineConfiguration(configuration: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(configuration).filter(([key]) => !reservedMachineKeys.has(key))
  );
}

function isMachineArchived(machine: { configuration: Record<string, string> }) {
  return Boolean(machine.configuration.__archivedAt);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rentalCompletionStatus(rental: { status: RentalRecord["status"]; endDate: string }) {
  if (rental.status === "completed") {
    return "completed" as const;
  }

  return rental.endDate < todayIso() ? "completed" : "active";
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function findDuplicateMachines(
  machines: MachineRecord[],
  currentMachine: MachineRecord
) {
  const keyValues = new Set(
    [
      currentMachine.machineNumber,
      currentMachine.internalNumber,
      currentMachine.serialNumber
    ]
      .map((value) => normalizeValue(value))
      .filter(Boolean)
  );
  const brandModel = `${normalizeValue(currentMachine.brand)}|${normalizeValue(currentMachine.model)}`;

  return machines.filter((candidate) => {
    if (candidate.id === currentMachine.id) {
      return false;
    }
    if (candidate.customerId !== currentMachine.customerId) {
      return false;
    }
    if (isMachineArchived(candidate)) {
      return false;
    }

    const candidateValues = [
      candidate.machineNumber,
      candidate.internalNumber,
      candidate.serialNumber
    ]
      .map((value) => normalizeValue(value))
      .filter(Boolean);

    if (candidateValues.some((value) => keyValues.has(value))) {
      return true;
    }

    return `${normalizeValue(candidate.brand)}|${normalizeValue(candidate.model)}` === brandModel;
  });
}

function nextInspectionNumber(existing: InspectionRecord[], inspectionDate: string) {
  const year = Number(inspectionDate.slice(0, 4));
  const base = getYearSequenceStart(year);
  const yearValues = existing
    .filter((item) => item.inspectionDate.startsWith(String(year)))
    .map((item) => Number(item.inspectionNumber))
    .filter((value) => !Number.isNaN(value));

  const next = yearValues.length > 0 ? Math.max(...yearValues) + 1 : base;
  return String(next);
}

function statusFromResultLabels(resultLabels: string[]) {
  const normalizedLabels = resultLabels.map((label) => label.toLowerCase());

  if (normalizedLabels.some((label) => label.includes("afgekeurd"))) {
    return "rejected" as const;
  }

  if (normalizedLabels.some((label) => label.includes("behandeling"))) {
    return "draft" as const;
  }

  return "approved" as const;
}

function buildMachineSnapshot(machine: {
  machineNumber: string;
  brand: string;
  model: string;
  serialNumber: string;
  buildYear: string;
  internalNumber: string;
  configuration: Record<string, string>;
}) {
  return {
    machine_number: machine.machineNumber,
    brand: machine.brand,
    model: machine.model,
    serial_number: machine.serialNumber,
    build_year: machine.buildYear,
    internal_number: machine.internalNumber,
    ...sanitizeMachineConfiguration(machine.configuration)
  };
}

function buildCustomerSnapshot(customer: {
  companyName: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
}) {
  return {
    customer_name: customer.companyName,
    customer_address: customer.address,
    customer_contact: customer.contactName,
    customer_phone: customer.phone,
    customer_email: customer.email
  };
}

function findOrCreateCustomer(
  data: AppDataSnapshot,
  input: CreateInspectionInput["customer"]
) {
  const match = data.customers.find(
    (customer) =>
      customer.companyName.toLowerCase() === input.companyName.toLowerCase()
  );

  if (match) {
    match.address = input.address;
    match.contactName = input.contactName;
    match.phone = input.phone;
    match.email = input.email;
    match.updatedAt = nowIso();
    return match;
  }

  const customer: CustomerRecord = {
    id: randomUUID(),
    companyName: input.companyName,
    address: input.address,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  data.customers.unshift(customer);
  return customer;
}

function findOrCreateMachine(
  data: AppDataSnapshot,
  customerId: string,
  input: CreateInspectionInput["machine"],
  machineType: CreateInspectionInput["machineType"]
) {
  const identifier = input.machineNumber || input.internalNumber;
  const match = data.machines.find(
    (machine) =>
      machine.machineNumber.toLowerCase() === identifier.toLowerCase()
  );

  if (match) {
    match.customerId = customerId;
    match.brand = input.brand;
    match.model = input.model;
    match.serialNumber = input.serialNumber;
    match.buildYear = input.buildYear;
    match.internalNumber = input.internalNumber;
    match.machineType = machineType;
    match.availabilityStatus = match.availabilityStatus ?? "available";
    match.configuration = sanitizeMachineConfiguration(input.details);
    match.updatedAt = nowIso();
    return match;
  }

  const machine: MachineRecord = {
    id: randomUUID(),
    customerId,
    machineNumber: identifier,
    machineType,
    availabilityStatus: "available",
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    buildYear: input.buildYear,
    internalNumber: input.internalNumber,
    configuration: sanitizeMachineConfiguration(input.details),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  data.machines.unshift(machine);
  return machine;
}

async function createDemoInspection(input: CreateInspectionInput) {
  const data = await readAppData();
  const customer =
    (input.customerId
      ? data.customers.find((item) => item.id === input.customerId)
      : null) ?? findOrCreateCustomer(data, input.customer);
  customer.address = input.customer.address;
  customer.contactName = input.customer.contactName;
  customer.phone = input.customer.phone;
  customer.email = input.customer.email;
  customer.updatedAt = nowIso();

  const machine =
    (input.machineId
      ? data.machines.find((item) => item.id === input.machineId)
      : null) ?? findOrCreateMachine(data, customer.id, input.machine, input.machineType);
  machine.customerId = customer.id;
  machine.machineNumber = input.machine.machineNumber;
  machine.machineType = input.machineType;
  machine.availabilityStatus = machine.availabilityStatus ?? "available";
  machine.brand = input.machine.brand;
  machine.model = input.machine.model;
  machine.serialNumber = input.machine.serialNumber;
  machine.buildYear = input.machine.buildYear;
  machine.internalNumber = input.machine.internalNumber;
  machine.configuration = sanitizeMachineConfiguration(input.machine.details);
  machine.updatedAt = nowIso();
  const inspectionNumber = nextInspectionNumber(data.inspections, input.inspectionDate);
  const nextInspectionDate = addTwelveMonths(input.inspectionDate);

  const inspection: InspectionRecord = {
    id: randomUUID(),
    inspectionNumber,
    customerId: customer.id,
    machineId: machine.id,
    machineType: input.machineType,
    inspectionDate: input.inspectionDate,
    nextInspectionDate,
    status: statusFromResultLabels(input.resultLabels),
    sendPdfToCustomer: input.sendPdfToCustomer,
    customerSnapshot: buildCustomerSnapshot(customer),
    machineSnapshot: buildMachineSnapshot(machine),
    checklist: input.checklist,
    findings: input.findings,
    recommendations: input.recommendations,
    conclusion: input.conclusion,
    resultLabels: input.resultLabels,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const documents = await generateInspectionDocuments(inspection, {
    persistToDisk: !process.env.VERCEL
  });
  inspection.pdfPath = documents.pdfPath;
  inspection.wordPath = documents.wordPath;
  data.inspections.unshift(inspection);
  if (documents.pdfPath) {
    data.attachments.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      kind: "pdf",
      fileName: documents.pdfFileName,
      storagePath: path.relative(process.cwd(), documents.pdfPath).replaceAll("\\", "/"),
      mimeType: "application/pdf",
      createdAt: nowIso()
    });
  }
  if (documents.wordPath) {
    data.attachments.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      kind: "word",
      fileName: documents.wordFileName,
      storagePath: path.relative(process.cwd(), documents.wordPath).replaceAll("\\", "/"),
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdAt: nowIso()
    });
  }

  for (const photo of input.photos) {
    const attachment = await storeInspectionPhoto(inspection.id, photo);
    data.attachments.unshift(attachment);
  }

  const planning: PlanningRecord = {
    id: randomUUID(),
    inspectionId: inspection.id,
    customerId: customer.id,
    machineId: machine.id,
    dueDate: nextInspectionDate,
    state: new Date(nextInspectionDate) < new Date() ? "overdue" : "scheduled",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  data.planningItems.unshift(planning);

  const internalMail = buildInternalMail(customer.companyName, inspection.inspectionNumber);
  const internalEvent = {
    id: randomUUID(),
    inspectionId: inspection.id,
    recipient: appConfig.mailInternalTo,
    subject: internalMail.subject,
    channel: "internal",
    deliveryStatus: "skipped",
    createdAt: nowIso()
  } as const;
  data.mailEvents.unshift(internalEvent);

  if (inspection.sendPdfToCustomer) {
    const customerMail = buildCustomerMail(customer.contactName);
    data.mailEvents.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      recipient: customer.email,
      subject: customerMail.subject,
      channel: "customer",
      deliveryStatus: "skipped",
      createdAt: nowIso()
    });
  }

  const sendResult = await sendInspectionEmails(
    inspection,
    customer.email,
    customer.contactName,
    customer.companyName,
    {
      pdf: {
        filename: documents.pdfFileName,
        content: documents.pdfBuffer
      },
      word: {
        filename: documents.wordFileName,
        content: documents.wordBuffer
      }
    }
  );
  const internalStoredEvent = data.mailEvents.find(
    (event) => event.inspectionId === inspection.id && event.channel === "internal"
  );
  if (internalStoredEvent) {
    internalStoredEvent.deliveryStatus = sendResult.internal;
  }
  const customerEvent = data.mailEvents.find(
    (event) => event.inspectionId === inspection.id && event.channel === "customer"
  );
  if (customerEvent) {
    customerEvent.deliveryStatus =
      sendResult.customer === "not_requested" ? "skipped" : sendResult.customer;
  }

  await writeAppData(data);
  return inspection;
}

async function syncSupabaseInspectionDocuments(
  inspection: InspectionRecord,
  existingAttachments: Array<{
    id: string;
    kind: string;
    storage_path: string;
  }>
) {
  const supabase = createSupabaseAdmin();
  const documents = await generateInspectionDocuments(inspection);
  const yearPrefix = inspection.inspectionDate.slice(0, 4);
  const versionToken = (inspection.updatedAt || nowIso()).replace(/[^0-9]/g, "").slice(0, 14);
  const pdfStoragePath = `${yearPrefix}/${inspection.inspectionNumber}/${inspection.inspectionNumber}-${versionToken}.pdf`;
  const wordStoragePath = `${yearPrefix}/${inspection.inspectionNumber}/${inspection.inspectionNumber}-${versionToken}.docx`;

  await supabase.storage
    .from("inspection-files")
    .upload(pdfStoragePath, documents.pdfBuffer, {
      upsert: true,
      contentType: "application/pdf"
    });
  await supabase.storage
    .from("inspection-files")
    .upload(wordStoragePath, documents.wordBuffer, {
      upsert: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

  await supabase
    .from("inspections")
    .update({
      pdf_path: pdfStoragePath,
      word_path: wordStoragePath
    })
    .eq("id", inspection.id);

  const pdfAttachment = existingAttachments.find((attachment) => attachment.kind === "pdf");
  const wordAttachment = existingAttachments.find((attachment) => attachment.kind === "word");

  if (pdfAttachment) {
    await supabase
      .from("inspection_attachments")
      .update({
        storage_path: pdfStoragePath,
        file_name: documents.pdfFileName,
        mime_type: "application/pdf"
      })
      .eq("id", pdfAttachment.id);
  } else {
    await supabase.from("inspection_attachments").insert({
      inspection_id: inspection.id,
      storage_path: pdfStoragePath,
      file_name: documents.pdfFileName,
      mime_type: "application/pdf",
      kind: "pdf"
    });
  }

  if (wordAttachment) {
    await supabase
      .from("inspection_attachments")
      .update({
        storage_path: wordStoragePath,
        file_name: documents.wordFileName,
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })
      .eq("id", wordAttachment.id);
  } else {
    await supabase.from("inspection_attachments").insert({
      inspection_id: inspection.id,
      storage_path: wordStoragePath,
      file_name: documents.wordFileName,
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      kind: "word"
    });
  }

  const stalePaths = existingAttachments
    .filter((attachment) => attachment.kind === "pdf" || attachment.kind === "word")
    .map((attachment) => attachment.storage_path)
    .filter(
      (storagePath) => storagePath !== pdfStoragePath && storagePath !== wordStoragePath
    );

  if (stalePaths.length > 0) {
    await supabase.storage.from("inspection-files").remove(stalePaths);
  }
}

async function syncDemoInspectionDocuments(
  data: AppDataSnapshot,
  inspection: InspectionRecord
) {
  const documents = await generateInspectionDocuments(inspection, {
    persistToDisk: !process.env.VERCEL
  });
  inspection.pdfPath = documents.pdfPath;
  inspection.wordPath = documents.wordPath;

  const pdfStoragePath = documents.pdfPath
    ? path.relative(process.cwd(), documents.pdfPath).replaceAll("\\", "/")
    : "";
  const wordStoragePath = documents.wordPath
    ? path.relative(process.cwd(), documents.wordPath).replaceAll("\\", "/")
    : "";

  const pdfAttachment = data.attachments.find(
    (attachment) => attachment.inspectionId === inspection.id && attachment.kind === "pdf"
  );
  const wordAttachment = data.attachments.find(
    (attachment) => attachment.inspectionId === inspection.id && attachment.kind === "word"
  );

  if (pdfAttachment && pdfStoragePath) {
    pdfAttachment.storagePath = pdfStoragePath;
    pdfAttachment.fileName = documents.pdfFileName;
    pdfAttachment.mimeType = "application/pdf";
    pdfAttachment.createdAt = nowIso();
  } else if (pdfStoragePath) {
    data.attachments.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      kind: "pdf",
      fileName: documents.pdfFileName,
      storagePath: pdfStoragePath,
      mimeType: "application/pdf",
      createdAt: nowIso()
    });
  }

  if (wordAttachment && wordStoragePath) {
    wordAttachment.storagePath = wordStoragePath;
    wordAttachment.fileName = documents.wordFileName;
    wordAttachment.mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    wordAttachment.createdAt = nowIso();
  } else if (wordStoragePath) {
    data.attachments.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      kind: "word",
      fileName: documents.wordFileName,
      storagePath: wordStoragePath,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdAt: nowIso()
    });
  }
}

function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
}

async function listDemoData() {
  try {
    return await readAppData();
  } catch {
    return demoData;
  }
}

function mapCustomerRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id),
    companyName: String(row.company_name ?? ""),
    address: String(row.address_line_1 ?? ""),
    city: String(row.city ?? ""),
    contactName: String(row.contact_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

function mapMachineRow(row: Record<string, unknown>): MachineRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    machineNumber: String(row.machine_number ?? ""),
    machineType: row.machine_type as CreateInspectionInput["machineType"],
    availabilityStatus:
      String(row.availability_status ?? "available") as MachineRecord["availabilityStatus"],
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    buildYear: String(row.build_year ?? ""),
    internalNumber: String(row.internal_number ?? ""),
    configuration: (row.configuration as Record<string, string>) ?? {},
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

function mapRentalRow(row: Record<string, unknown>): RentalRecord {
  return {
    id: String(row.id),
    machineId: String(row.machine_id),
    customerId: String(row.customer_id),
    startDate: String(row.start_date ?? ""),
    endDate: String(row.end_date ?? ""),
    status: String(row.status ?? "active") as RentalRecord["status"],
    price: row.price ? String(row.price) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

function mapInspectionRow(row: Record<string, unknown>): InspectionRecord {
  return {
    id: String(row.id),
    inspectionNumber: String(row.inspection_number ?? ""),
    customerId: String(row.customer_id),
    machineId: String(row.machine_id),
    machineType: row.machine_type as CreateInspectionInput["machineType"],
    inspectionDate: String(row.inspection_date ?? ""),
    nextInspectionDate: String(row.next_inspection_date ?? ""),
    status: row.status as InspectionRecord["status"],
    sendPdfToCustomer: Boolean(row.send_pdf_to_customer),
    customerSnapshot: (row.customer_snapshot as Record<string, string>) ?? {},
    machineSnapshot: (row.machine_snapshot as Record<string, string>) ?? {},
    checklist: row.checklist as InspectionRecord["checklist"],
    findings: String(row.findings ?? ""),
    recommendations: String(row.recommendations ?? ""),
    conclusion: String(row.conclusion ?? ""),
    resultLabels: [],
    pdfPath: row.pdf_path ? String(row.pdf_path) : undefined,
    wordPath: row.word_path ? String(row.word_path) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

function mapPlanningRow(row: Record<string, unknown>): PlanningRecord {
  return {
    id: String(row.id),
    inspectionId: String(row.inspection_id ?? ""),
    customerId: String(row.customer_id),
    machineId: String(row.machine_id),
    dueDate: String(row.due_date ?? ""),
    state: row.state as PlanningRecord["state"],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

export async function createInspection(input: CreateInspectionInput) {
  if (!hasSupabaseConfig()) {
    return createDemoInspection(input);
  }

  const supabase = createSupabaseAdmin();
  const status = statusFromResultLabels(input.resultLabels);
  const nextInspectionDate = addTwelveMonths(input.inspectionDate);

  let customerRow: Record<string, unknown> | null = null;
  if (input.customerId) {
    const { data } = await supabase
      .from("customers")
      .update({
        company_name: input.customer.companyName,
        address_line_1: input.customer.address,
        contact_name: input.customer.contactName,
        phone: input.customer.phone,
        email: input.customer.email
      })
      .eq("id", input.customerId)
      .select()
      .single();
    customerRow = data;
  } else {
    const { data } = await supabase
      .from("customers")
      .upsert(
        {
          company_name: input.customer.companyName,
          address_line_1: input.customer.address,
          contact_name: input.customer.contactName,
          phone: input.customer.phone,
          email: input.customer.email
        },
        { onConflict: "company_name" }
      )
      .select()
      .single();
    customerRow = data;
  }

  let machineRow: Record<string, unknown> | null = null;
  if (input.machineId) {
    const { data } = await supabase
      .from("machines")
      .update({
        customer_id: customerRow?.id,
        machine_number: input.machine.machineNumber,
        machine_type: input.machineType,
        brand: input.machine.brand,
        model: input.machine.model,
        serial_number: input.machine.serialNumber,
        build_year: Number(input.machine.buildYear || 0) || null,
        internal_number: input.machine.internalNumber,
        configuration: sanitizeMachineConfiguration(input.machine.details)
      })
      .eq("id", input.machineId)
      .select()
      .single();
    machineRow = data;
  } else {
    const { data } = await supabase
      .from("machines")
      .upsert(
        {
          customer_id: customerRow?.id,
          machine_number: input.machine.machineNumber,
          machine_type: input.machineType,
          brand: input.machine.brand,
          model: input.machine.model,
          serial_number: input.machine.serialNumber,
          build_year: Number(input.machine.buildYear || 0) || null,
          internal_number: input.machine.internalNumber,
          configuration: sanitizeMachineConfiguration(input.machine.details)
        },
        { onConflict: "machine_number" }
      )
      .select()
      .single();
    machineRow = data;
  }

  const { data: generatedInspectionNumber, error: sequenceError } = await supabase.rpc(
    "next_inspection_number",
    {
      target_date: input.inspectionDate
    }
  );

  if (sequenceError || generatedInspectionNumber == null) {
    throw new Error("Keurnummer kon niet worden aangemaakt.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("inspections")
    .insert({
      inspection_number: generatedInspectionNumber,
      customer_id: customerRow?.id,
      machine_id: machineRow?.id,
      machine_type: input.machineType,
      inspection_date: input.inspectionDate,
      next_inspection_date: nextInspectionDate,
      status,
      send_pdf_to_customer: input.sendPdfToCustomer,
      checklist: input.checklist,
      customer_snapshot: buildCustomerSnapshot(input.customer),
      machine_snapshot: buildMachineSnapshot({
        machineNumber: input.machine.machineNumber,
        brand: input.machine.brand,
        model: input.machine.model,
        serialNumber: input.machine.serialNumber,
        buildYear: input.machine.buildYear,
        internalNumber: input.machine.internalNumber,
        configuration: sanitizeMachineConfiguration(input.machine.details)
      }),
      findings: input.findings,
      recommendations: input.recommendations,
      conclusion: input.conclusion
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || "Keuring kon niet worden opgeslagen.");
  }

  const inspection: InspectionRecord = {
    id: inserted.id,
    inspectionNumber: String(inserted.inspection_number),
    customerId: inserted.customer_id,
    machineId: inserted.machine_id,
    machineType: inserted.machine_type,
    inspectionDate: inserted.inspection_date,
    nextInspectionDate: inserted.next_inspection_date,
    status: inserted.status,
    sendPdfToCustomer: inserted.send_pdf_to_customer,
    customerSnapshot: inserted.customer_snapshot,
    machineSnapshot: inserted.machine_snapshot,
    checklist: inserted.checklist,
    findings: inserted.findings ?? "",
    recommendations: inserted.recommendations ?? "",
    conclusion: inserted.conclusion ?? "",
    resultLabels: input.resultLabels,
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at
  };

  const documents = await generateInspectionDocuments(inspection);
  const mailInspection = {
    ...inspection,
    pdfPath: documents.pdfPath,
    wordPath: documents.wordPath
  };
  const pdfStoragePath = `${inspection.inspectionDate.slice(0, 4)}/${inspection.inspectionNumber}/${documents.pdfFileName}`;
  const wordStoragePath = `${inspection.inspectionDate.slice(0, 4)}/${inspection.inspectionNumber}/${documents.wordFileName}`;

  await supabase.storage
    .from("inspection-files")
    .upload(pdfStoragePath, documents.pdfBuffer, { upsert: true, contentType: "application/pdf" });
  await supabase.storage
    .from("inspection-files")
    .upload(wordStoragePath, documents.wordBuffer, {
      upsert: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

  await supabase
    .from("inspections")
    .update({
      pdf_path: pdfStoragePath,
      word_path: wordStoragePath
    })
    .eq("id", inspection.id);

  inspection.pdfPath = pdfStoragePath;
  inspection.wordPath = wordStoragePath;

  await supabase.from("inspection_attachments").insert([
    {
      inspection_id: inspection.id,
      storage_path: pdfStoragePath,
      file_name: path.basename(pdfStoragePath),
      mime_type: "application/pdf",
      kind: "pdf"
    },
    {
      inspection_id: inspection.id,
      storage_path: wordStoragePath,
      file_name: path.basename(wordStoragePath),
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      kind: "word"
    }
  ]);

  for (const photo of input.photos) {
    await storeInspectionPhoto(inspection.id, photo);
  }

  await supabase.from("planning_items").insert({
    inspection_id: inspection.id,
    customer_id: inspection.customerId,
    machine_id: inspection.machineId,
    due_date: inspection.nextInspectionDate,
    state: new Date(inspection.nextInspectionDate) < new Date() ? "overdue" : "scheduled"
  });

  const internalMail = buildInternalMail(input.customer.companyName, inspection.inspectionNumber);
  const sendResult = await sendInspectionEmails(
    mailInspection,
    input.customer.email,
    input.customer.contactName,
    input.customer.companyName,
    {
      pdf: {
        filename: documents.pdfFileName,
        content: documents.pdfBuffer
      },
      word: {
        filename: documents.wordFileName,
        content: documents.wordBuffer
      }
    }
  );

  await supabase.from("mail_events").insert({
    inspection_id: inspection.id,
    recipient: appConfig.mailInternalTo,
    subject: internalMail.subject,
    channel: "internal",
    delivery_status: sendResult.internal
  });

  if (inspection.sendPdfToCustomer) {
    const customerMail = buildCustomerMail(input.customer.contactName);
    await supabase.from("mail_events").insert({
      inspection_id: inspection.id,
      recipient: input.customer.email,
      subject: customerMail.subject,
      channel: "customer",
      delivery_status:
        sendResult.customer === "not_requested" ? "skipped" : sendResult.customer
    });
  }

  return inspection;
}

export async function updateInspectionFromForm(
  inspectionId: string,
  input: CreateInspectionInput
) {
  if (!hasSupabaseConfig()) {
    const data = await readAppData();
    const inspection = data.inspections.find((item) => item.id === inspectionId);
    if (!inspection) {
      throw new Error("Keuring niet gevonden");
    }

    const customer =
      (input.customerId
        ? data.customers.find((item) => item.id === input.customerId)
        : null) ?? findOrCreateCustomer(data, input.customer);
    customer.address = input.customer.address;
    customer.contactName = input.customer.contactName;
    customer.phone = input.customer.phone;
    customer.email = input.customer.email;
    customer.updatedAt = nowIso();

    const machine =
      (input.machineId
        ? data.machines.find((item) => item.id === input.machineId)
        : null) ?? findOrCreateMachine(data, customer.id, input.machine, input.machineType);
    machine.customerId = customer.id;
    machine.machineNumber = input.machine.machineNumber;
    machine.machineType = input.machineType;
    machine.brand = input.machine.brand;
    machine.model = input.machine.model;
    machine.serialNumber = input.machine.serialNumber;
    machine.buildYear = input.machine.buildYear;
    machine.internalNumber = input.machine.internalNumber;
    machine.configuration = sanitizeMachineConfiguration(input.machine.details);
    machine.updatedAt = nowIso();

    inspection.customerId = customer.id;
    inspection.machineId = machine.id;
    inspection.machineType = input.machineType;
    inspection.inspectionDate = input.inspectionDate;
    inspection.nextInspectionDate = addTwelveMonths(input.inspectionDate);
    inspection.status = statusFromResultLabels(input.resultLabels);
    inspection.sendPdfToCustomer = input.sendPdfToCustomer;
    inspection.customerSnapshot = buildCustomerSnapshot(customer);
    inspection.machineSnapshot = buildMachineSnapshot(machine);
    inspection.checklist = input.checklist;
    inspection.findings = input.findings;
    inspection.recommendations = input.recommendations;
    inspection.conclusion = input.conclusion;
    inspection.resultLabels = input.resultLabels;
    inspection.updatedAt = nowIso();

    const planningItem = data.planningItems.find((item) => item.inspectionId === inspection.id);
    if (planningItem) {
      planningItem.customerId = customer.id;
      planningItem.machineId = machine.id;
      planningItem.dueDate = inspection.nextInspectionDate;
      planningItem.state =
        new Date(inspection.nextInspectionDate) < new Date() ? "overdue" : "scheduled";
      planningItem.updatedAt = nowIso();
    }

    await syncDemoInspectionDocuments(data, inspection);
    await writeAppData(data);
    return inspection;
  }

  const supabase = createSupabaseAdmin();
  const { data: currentInspectionRow } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", inspectionId)
    .maybeSingle();

  if (!currentInspectionRow) {
    throw new Error("Keuring niet gevonden");
  }

  const currentInspection = mapInspectionRow(currentInspectionRow);
  const resolvedCustomerId = input.customerId ?? currentInspection.customerId;
  const resolvedMachineId = input.machineId ?? currentInspection.machineId;

  let customerRow: Record<string, unknown> | null = null;
  if (resolvedCustomerId) {
    const { data } = await supabase
      .from("customers")
      .update({
        company_name: input.customer.companyName,
        address_line_1: input.customer.address,
        contact_name: input.customer.contactName,
        phone: input.customer.phone,
        email: input.customer.email
      })
      .eq("id", resolvedCustomerId)
      .select()
      .maybeSingle();
    customerRow = data;

    if (!customerRow) {
      const { data: fallbackCustomerRow } = await supabase
        .from("customers")
        .select("*")
        .eq("id", resolvedCustomerId)
        .maybeSingle();
      customerRow = fallbackCustomerRow;
    }
  }

  let machineRow: Record<string, unknown> | null = null;
  if (resolvedMachineId) {
    const { data } = await supabase
      .from("machines")
      .update({
        customer_id: resolvedCustomerId,
        machine_number: input.machine.machineNumber,
        machine_type: input.machineType,
        brand: input.machine.brand,
        model: input.machine.model,
        serial_number: input.machine.serialNumber,
        build_year: Number(input.machine.buildYear || 0) || null,
        internal_number: input.machine.internalNumber,
        configuration: sanitizeMachineConfiguration(input.machine.details)
      })
      .eq("id", resolvedMachineId)
      .select()
      .maybeSingle();
    machineRow = data;

    if (!machineRow) {
      const { data: fallbackMachineRow } = await supabase
        .from("machines")
        .select("*")
        .eq("id", resolvedMachineId)
        .maybeSingle();
      machineRow = fallbackMachineRow;
    }
  }

  if (!customerRow || !machineRow) {
    throw new Error("Klant of machine kon niet worden bijgewerkt.");
  }

  const nextInspectionDate = addTwelveMonths(input.inspectionDate);
  const status = statusFromResultLabels(input.resultLabels);

  const { data: updatedRow } = await supabase
    .from("inspections")
    .update({
      customer_id: resolvedCustomerId,
      machine_id: resolvedMachineId,
      machine_type: input.machineType,
      inspection_date: input.inspectionDate,
      next_inspection_date: nextInspectionDate,
      status,
      send_pdf_to_customer: input.sendPdfToCustomer,
      checklist: input.checklist,
      customer_snapshot: buildCustomerSnapshot(input.customer),
      machine_snapshot: buildMachineSnapshot({
        machineNumber: input.machine.machineNumber,
        brand: input.machine.brand,
        model: input.machine.model,
        serialNumber: input.machine.serialNumber,
        buildYear: input.machine.buildYear,
        internalNumber: input.machine.internalNumber,
        configuration: sanitizeMachineConfiguration(input.machine.details)
      }),
      findings: input.findings,
      recommendations: input.recommendations,
      conclusion: input.conclusion
    })
    .eq("id", inspectionId)
    .select("*")
    .maybeSingle();

  if (!updatedRow) {
    throw new Error("Keuring kon niet worden bijgewerkt.");
  }

  const inspection = mapInspectionRow(updatedRow);

  await supabase
    .from("planning_items")
    .update({
      customer_id: inspection.customerId,
      machine_id: inspection.machineId,
      due_date: inspection.nextInspectionDate,
      state: new Date(inspection.nextInspectionDate) < new Date() ? "overdue" : "scheduled"
    })
    .eq("inspection_id", inspection.id);

  const { data: attachmentRows } = await supabase
    .from("inspection_attachments")
    .select("id, kind, storage_path")
    .eq("inspection_id", inspection.id);

  await syncSupabaseInspectionDocuments(
    inspection,
    (attachmentRows ?? []).map((attachment) => ({
      id: String(attachment.id),
      kind: String(attachment.kind),
      storage_path: String(attachment.storage_path)
    }))
  );

  return inspection;
}

export async function getDashboardData() {
  const data = hasSupabaseConfig()
    ? {
        customers: await getCustomers(),
        machines: await getMachines(),
        inspections: await getInspections(),
        planningItems: await getPlanningItems(),
        attachments: await getInspectionAttachments(),
        mailEvents: []
      }
    : await listDemoData();
  const upcoming = data.planningItems.filter((item) => item.state === "scheduled").length;
  const overdue = data.planningItems.filter((item) => item.state === "overdue").length;
  const drafts = data.inspections.filter((item) => item.status === "draft").length;

  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);
  const monday = new Date(now);
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    drafts,
    inspectionsThisMonth: data.inspections.filter((item) => item.inspectionDate.startsWith(monthPrefix)).length,
    inspectionsThisWeek: data.inspections.filter((item) => {
      const inspectionDate = new Date(item.inspectionDate);
      return inspectionDate >= monday && inspectionDate <= sunday;
    }).length,
    upcoming,
    overdue
  };
}

export async function getCustomers() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("company_name", { ascending: true });
    return (data ?? []).map((row) => mapCustomerRow(row));
  }
  const data = await listDemoData();
  return data.customers;
}

export async function getVisibleCustomers() {
  const customers = await getCustomers();
  return customers.filter((customer) => !isRentalStockCustomer(customer));
}

export async function getMachines() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("machines")
      .select("*")
      .order("machine_number", { ascending: true });
    return (data ?? [])
      .map((row) => mapMachineRow(row))
      .filter((machine) => !isMachineArchived(machine));
  }
  const data = await listDemoData();
  return data.machines
    .map((machine) => ({
      ...machine,
      availabilityStatus: machine.availabilityStatus ?? "available"
    }))
    .filter((machine) => !isMachineArchived(machine));
}

export async function getInspections() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("inspections")
      .select("*")
      .order("inspection_date", { ascending: false });
    return (data ?? []).map((row) => mapInspectionRow(row));
  }
  const data = await listDemoData();
  return data.inspections;
}

export async function getPlanningItems() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("planning_items")
      .select("*")
      .order("due_date", { ascending: true });
    return (data ?? []).map((row) => mapPlanningRow(row));
  }
  const data = await listDemoData();
  return data.planningItems;
}

export async function getRentals() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("rentals")
      .select("*")
      .order("start_date", { ascending: false });
    return (data ?? []).map((row) => mapRentalRow(row));
  }

  const data = await listDemoData();
  return data.rentals;
}

export async function createManualPlanningItem(input: {
  customerId: string;
  machineId: string;
  dueDate: string;
}) {
  const state =
    new Date(input.dueDate) < new Date()
      ? "overdue"
      : ("scheduled" as const);

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: existing } = await supabase
      .from("planning_items")
      .select("*")
      .eq("customer_id", input.customerId)
      .eq("machine_id", input.machineId)
      .eq("due_date", input.dueDate)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("planning_items")
        .update({
          state,
          notes: "Handmatig gepland"
        })
        .eq("id", existing.id);
      return String(existing.id);
    }

    const { data } = await supabase
      .from("planning_items")
      .insert({
        inspection_id: null,
        customer_id: input.customerId,
        machine_id: input.machineId,
        due_date: input.dueDate,
        state,
        notes: "Handmatig gepland"
      })
      .select("id")
      .single();

    return String(data?.id ?? "");
  }

  const data = await readAppData();
  const existing = data.planningItems.find(
    (item) =>
      item.customerId === input.customerId &&
      item.machineId === input.machineId &&
      item.dueDate === input.dueDate
  );

  if (existing) {
    existing.state = state;
    existing.updatedAt = nowIso();
    await writeAppData(data);
    return existing.id;
  }

  const planningItem: PlanningRecord = {
    id: randomUUID(),
    inspectionId: "",
    customerId: input.customerId,
    machineId: input.machineId,
    dueDate: input.dueDate,
    state,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  data.planningItems.unshift(planningItem);
  await writeAppData(data);
  return planningItem.id;
}

export async function getInspectionAttachments() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("inspection_attachments")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []).map((row) => ({
      id: String(row.id),
      inspectionId: String(row.inspection_id),
      kind: row.kind,
      fileName: String(row.file_name),
      storagePath: String(row.storage_path),
      mimeType: String(row.mime_type),
      createdAt: String(row.created_at)
    }));
  }

  const data = await listDemoData();
  return data.attachments;
}

export async function getMachineById(id: string) {
  const machines = await getMachines();
  return machines.find((machine) => machine.id === id) ?? null;
}

export async function getInspectionById(id: string) {
  const inspections = await getInspections();
  return inspections.find((inspection) => inspection.id === id) ?? null;
}

export async function getMachineHistory(machineId: string) {
  const inspections = await getInspections();
  return inspections.filter((inspection) => inspection.machineId === machineId);
}

export async function getAttachmentsForInspection(inspectionId: string) {
  const attachments = await getInspectionAttachments();
  return attachments.filter((attachment) => attachment.inspectionId === inspectionId);
}

export async function getCustomerById(id: string) {
  const customers = await getCustomers();
  return customers.find((customer) => customer.id === id) ?? null;
}

export async function getMachinesForCustomer(customerId: string) {
  const machines = await getMachines();
  return machines.filter((machine) => machine.customerId === customerId);
}

export async function getRentalsForMachine(machineId: string) {
  const rentals = await getRentals();
  return rentals.filter((rental) => rental.machineId === machineId);
}

export async function getRentalsForCustomer(customerId: string) {
  const rentals = await getRentals();
  return rentals.filter((rental) => rental.customerId === customerId);
}

function normalizeRentalOwnerText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isRentalStockCustomer(
  customer?: Pick<CustomerRecord, "companyName" | "email"> | null
) {
  const company = normalizeRentalOwnerText(customer?.companyName);
  const email = normalizeRentalOwnerText(customer?.email);
  return (
    company.includes("heftrucks") ||
    company.includes("friesland") ||
    email.includes("@heftrucks.frl") ||
    email.includes("heftrucks.frl")
  );
}

export async function getRentalStockMachines() {
  const [machines, customers] = await Promise.all([getMachines(), getCustomers()]);
  const stockCustomerIds = new Set(
    customers.filter((customer) => isRentalStockCustomer(customer)).map((customer) => customer.id)
  );

  return machines.filter((machine) => stockCustomerIds.has(machine.customerId));
}

export async function createCustomer(input: {
  companyName: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  city?: string;
}) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("customers")
      .upsert(
        {
          company_name: input.companyName,
          address_line_1: input.address,
          city: input.city ?? "",
          contact_name: input.contactName,
          phone: input.phone,
          email: input.email
        },
        { onConflict: "company_name" }
      )
      .select()
      .single();

    return data ? mapCustomerRow(data).id : "";
  }

  const data = await readAppData();
  const existing = data.customers.find(
    (customer) => customer.companyName.toLowerCase() === input.companyName.toLowerCase()
  );

  if (existing) {
    existing.address = input.address;
    existing.city = input.city ?? "";
    existing.contactName = input.contactName;
    existing.phone = input.phone;
    existing.email = input.email;
    existing.updatedAt = nowIso();
    await writeAppData(data);
    return existing.id;
  }

  const customer: CustomerRecord = {
    id: randomUUID(),
    companyName: input.companyName,
    address: input.address,
    city: input.city ?? "",
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  data.customers.unshift(customer);
  await writeAppData(data);
  return customer.id;
}

export async function updateCustomer(input: {
  id: string;
  companyName: string;
  address: string;
  city?: string;
  contactName: string;
  phone: string;
  email: string;
}) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    await supabase
      .from("customers")
      .update({
        company_name: input.companyName,
        address_line_1: input.address,
        city: input.city ?? "",
        contact_name: input.contactName,
        phone: input.phone,
        email: input.email
      })
      .eq("id", input.id);

    return;
  }

  const data = await readAppData();
  const customer = data.customers.find((item) => item.id === input.id);
  if (!customer) {
    return;
  }

  customer.companyName = input.companyName;
  customer.address = input.address;
  customer.city = input.city ?? "";
  customer.contactName = input.contactName;
  customer.phone = input.phone;
  customer.email = input.email;
  customer.updatedAt = nowIso();
  await writeAppData(data);
}

export async function createMachine(input: {
  customerId: string;
  machineType: CreateInspectionInput["machineType"];
  brand: string;
  model: string;
  serialNumber: string;
  buildYear: string;
  internalNumber: string;
}) {
  const machineNumber =
    input.internalNumber.trim() ||
    input.serialNumber.trim() ||
    `${input.brand.trim()}-${input.model.trim()}`.replace(/\s+/g, "-").toLowerCase() ||
    randomUUID().slice(0, 8);

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("machines")
      .upsert(
        {
          customer_id: input.customerId,
          machine_number: machineNumber,
          machine_type: input.machineType,
          availability_status: "available",
          brand: input.brand,
          model: input.model,
          serial_number: input.serialNumber,
          build_year: Number(input.buildYear || 0) || null,
          internal_number: input.internalNumber,
          configuration: {}
        },
        { onConflict: "machine_number" }
      )
      .select()
      .single();

    return data ? mapMachineRow(data).id : "";
  }

  const data = await readAppData();
  const existing = data.machines.find(
    (machine) => machine.machineNumber.toLowerCase() === machineNumber.toLowerCase()
  );

  if (existing) {
    existing.customerId = input.customerId;
    existing.machineType = input.machineType;
    existing.availabilityStatus = existing.availabilityStatus ?? "available";
    existing.brand = input.brand;
    existing.model = input.model;
    existing.serialNumber = input.serialNumber;
    existing.buildYear = input.buildYear;
    existing.internalNumber = input.internalNumber;
    existing.updatedAt = nowIso();
    await writeAppData(data);
    return existing.id;
  }

  const machine: MachineRecord = {
    id: randomUUID(),
    customerId: input.customerId,
    machineNumber,
    machineType: input.machineType,
    availabilityStatus: "available",
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    buildYear: input.buildYear,
    internalNumber: input.internalNumber,
    configuration: {},
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  data.machines.unshift(machine);
  await writeAppData(data);
  return machine.id;
}

export async function createRental(input: {
  machineId: string;
  customerId: string;
  startDate: string;
  endDate: string;
  price?: string;
}) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: machineRow } = await supabase
      .from("machines")
      .select("*")
      .eq("id", input.machineId)
      .maybeSingle();

    if (!machineRow) {
      throw new Error("Machine niet gevonden.");
    }

    const machine = mapMachineRow(machineRow);
    const { data: ownerRow } = await supabase
      .from("customers")
      .select("*")
      .eq("id", machine.customerId)
      .maybeSingle();

    const ownerCustomer = ownerRow ? mapCustomerRow(ownerRow) : null;
    if (!isRentalStockCustomer(ownerCustomer)) {
      throw new Error("Alleen voorraadmachines van Heftrucks Friesland zijn verhuurbaar.");
    }

    const { data: existingRental } = await supabase
      .from("rentals")
      .select("id")
      .eq("machine_id", input.machineId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingRental) {
      throw new Error("Deze machine staat al in verhuur.");
    }

    const { data } = await supabase
      .from("rentals")
      .insert({
        machine_id: input.machineId,
        customer_id: input.customerId,
        start_date: input.startDate,
        end_date: input.endDate,
        status: "active",
        price: input.price?.trim() || null
      })
      .select("*")
      .single();

    await supabase
      .from("machines")
      .update({ availability_status: "rented" })
      .eq("id", input.machineId);

    return mapRentalRow(data);
  }

  const data = await readAppData();
  const machine = data.machines.find((item) => item.id === input.machineId);
  if (!machine) {
    throw new Error("Machine niet gevonden.");
  }

  const ownerCustomer = data.customers.find((item) => item.id === machine.customerId) ?? null;
  if (!isRentalStockCustomer(ownerCustomer)) {
    throw new Error("Alleen voorraadmachines van Heftrucks Friesland zijn verhuurbaar.");
  }

  const existingRental = data.rentals.find(
    (item) => item.machineId === input.machineId && item.status === "active"
  );
  if (existingRental) {
    throw new Error("Deze machine staat al in verhuur.");
  }

  const rental: RentalRecord = {
    id: randomUUID(),
    machineId: input.machineId,
    customerId: input.customerId,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "active",
    price: input.price?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  data.rentals.unshift(rental);
  machine.availabilityStatus = "rented";
  machine.updatedAt = nowIso();
  await writeAppData(data);
  return rental;
}

export async function completeRental(rentalId: string) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: rentalRow } = await supabase
      .from("rentals")
      .update({ status: "completed" })
      .eq("id", rentalId)
      .select("*")
      .maybeSingle();

    if (!rentalRow) {
      return;
    }

    const rental = mapRentalRow(rentalRow);
    const { data: openRentals } = await supabase
      .from("rentals")
      .select("id")
      .eq("machine_id", rental.machineId)
      .eq("status", "active");

    if ((openRentals ?? []).length === 0) {
      await supabase
        .from("machines")
        .update({ availability_status: "available" })
        .eq("id", rental.machineId);
    }
    return;
  }

  const data = await readAppData();
  const rental = data.rentals.find((item) => item.id === rentalId);
  if (!rental) {
    return;
  }

  rental.status = "completed";
  rental.updatedAt = nowIso();

  const hasOpenRental = data.rentals.some(
    (item) =>
      item.machineId === rental.machineId &&
      item.id !== rentalId &&
      rentalCompletionStatus(item) === "active"
  );

  if (!hasOpenRental) {
    const machine = data.machines.find((item) => item.id === rental.machineId);
    if (machine) {
      machine.availabilityStatus = "available";
      machine.updatedAt = nowIso();
    }
  }

  await writeAppData(data);
}

export async function archiveMachine(machineId: string) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: machineRow } = await supabase
      .from("machines")
      .select("*")
      .eq("id", machineId)
      .maybeSingle();

    if (!machineRow) {
      return;
    }

    const machine = mapMachineRow(machineRow);
    await supabase
      .from("machines")
      .update({
        configuration: {
          ...machine.configuration,
          __archivedAt: nowIso()
        }
      })
      .eq("id", machineId);
    return;
  }

  const data = await readAppData();
  const machine = data.machines.find((item) => item.id === machineId);
  if (!machine) {
    return;
  }

  machine.configuration = {
    ...machine.configuration,
    __archivedAt: nowIso()
  };
  machine.updatedAt = nowIso();
  await writeAppData(data);
}

export async function deleteMachine(machineId: string) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { count } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", machineId);

    if ((count ?? 0) > 0) {
      throw new Error("Deze machine heeft al keuringen en kan niet definitief worden verwijderd.");
    }

    await supabase
      .from("planning_items")
      .delete()
      .eq("machine_id", machineId);
    await supabase
      .from("machines")
      .delete()
      .eq("id", machineId);
    return;
  }

  const data = await readAppData();
  if (data.inspections.some((inspection) => inspection.machineId === machineId)) {
    throw new Error("Deze machine heeft al keuringen en kan niet definitief worden verwijderd.");
  }

  data.planningItems = data.planningItems.filter((item) => item.machineId !== machineId);
  data.machines = data.machines.filter((item) => item.id !== machineId);
  await writeAppData(data);
}

export async function updatePlanningItem(input: {
  id: string;
  dueDate: string;
}) {
  const state =
    new Date(input.dueDate) < new Date()
      ? "overdue"
      : ("scheduled" as const);

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    await supabase
      .from("planning_items")
      .update({
        due_date: input.dueDate,
        state
      })
      .eq("id", input.id);
    return;
  }

  const data = await readAppData();
  const item = data.planningItems.find((planningItem) => planningItem.id === input.id);
  if (!item) {
    return;
  }

  item.dueDate = input.dueDate;
  item.state = state;
  item.updatedAt = nowIso();
  await writeAppData(data);
}

export async function updateMachine(input: {
  id: string;
  machineType: CreateInspectionInput["machineType"];
  brand: string;
  model: string;
  serialNumber: string;
  buildYear: string;
  internalNumber: string;
  details: Record<string, string>;
}) {
  const machineNumber =
    input.internalNumber.trim() ||
    input.serialNumber.trim() ||
    `${input.brand.trim()}-${input.model.trim()}`.replace(/\s+/g, "-").toLowerCase() ||
    input.id;

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: currentMachineRows } = await supabase
      .from("machines")
      .select("*")
      .eq("id", input.id)
      .limit(1);
    const currentMachine = currentMachineRows?.[0] ? mapMachineRow(currentMachineRows[0]) : null;
    const duplicateMachines = currentMachine
      ? findDuplicateMachines(
          ((await supabase
            .from("machines")
            .select("*")
            .eq("customer_id", currentMachine.customerId)).data ?? []).map((row) =>
            mapMachineRow(row)
          ),
          currentMachine
        )
      : [];

    const { data: updatedMachineRow } = await supabase
      .from("machines")
      .update({
        machine_number: machineNumber,
        brand: input.brand,
        model: input.model,
        serial_number: input.serialNumber,
        build_year: Number(input.buildYear || 0) || null,
        internal_number: input.internalNumber,
        machine_type: input.machineType,
        configuration: sanitizeMachineConfiguration(input.details)
      })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();

    if (!updatedMachineRow) {
      return [];
    }

    const machine = mapMachineRow(updatedMachineRow);
    const machineSnapshot = buildMachineSnapshot(machine);
    const duplicateIds = duplicateMachines.map((item) => item.id);

    if (duplicateIds.length > 0) {
      await supabase
        .from("planning_items")
        .update({ machine_id: input.id })
        .in("machine_id", duplicateIds);

      await supabase
        .from("machines")
        .update({
          configuration: {
            __archivedAt: nowIso()
          }
        })
        .in("id", duplicateIds);
    }

    const affectedMachineIds = [input.id, ...duplicateIds];
    const { data: inspectionRows } = await supabase
      .from("inspections")
      .update({
        machine_id: input.id,
        machine_snapshot: machineSnapshot
      })
      .in("machine_id", affectedMachineIds)
      .select("*");

    const affectedInspectionIds: string[] = [];

    for (const row of inspectionRows ?? []) {
      const inspection = mapInspectionRow(row);
      affectedInspectionIds.push(inspection.id);
      const { data: attachmentRows } = await supabase
        .from("inspection_attachments")
        .select("id, kind, storage_path")
        .eq("inspection_id", inspection.id);

      await syncSupabaseInspectionDocuments(
        inspection,
        (attachmentRows ?? []).map((attachment) => ({
          id: String(attachment.id),
          kind: String(attachment.kind),
          storage_path: String(attachment.storage_path)
        }))
      );
    }

    return affectedInspectionIds;
  }

  const data = await readAppData();
  const machine = data.machines.find((item) => item.id === input.id);
  if (!machine) {
    return [];
  }

  const duplicateMachines = findDuplicateMachines(data.machines, machine);

  machine.brand = input.brand;
  machine.model = input.model;
  machine.serialNumber = input.serialNumber;
  machine.buildYear = input.buildYear;
  machine.internalNumber = input.internalNumber;
  machine.machineNumber = machineNumber;
  machine.machineType = input.machineType;
  machine.availabilityStatus = machine.availabilityStatus ?? "available";
  machine.configuration = sanitizeMachineConfiguration(input.details);
  machine.updatedAt = nowIso();

  for (const duplicate of duplicateMachines) {
    duplicate.configuration = {
      __archivedAt: nowIso()
    };
    duplicate.updatedAt = nowIso();
  }

  for (const planningItem of data.planningItems) {
    if (duplicateMachines.some((duplicate) => duplicate.id === planningItem.machineId)) {
      planningItem.machineId = input.id;
      planningItem.updatedAt = nowIso();
    }
  }

  const machineSnapshot = buildMachineSnapshot(machine);
  const affectedInspectionIds: string[] = [];
  for (const inspection of data.inspections) {
    if (
      inspection.machineId !== input.id &&
      !duplicateMachines.some((duplicate) => duplicate.id === inspection.machineId)
    ) {
      continue;
    }

    inspection.machineId = input.id;
    inspection.machineSnapshot = machineSnapshot;
    inspection.updatedAt = nowIso();
    affectedInspectionIds.push(inspection.id);
    await syncDemoInspectionDocuments(data, inspection);
  }

  await writeAppData(data);
  return affectedInspectionIds;
}

export async function assignMachineToCustomer(input: {
  machineId: string;
  customerId: string;
}) {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data: customerRow } = await supabase
      .from("customers")
      .select("*")
      .eq("id", input.customerId)
      .maybeSingle();
    const { data: machineRow } = await supabase
      .from("machines")
      .update({ customer_id: input.customerId })
      .eq("id", input.machineId)
      .select("*")
      .maybeSingle();

    if (!customerRow || !machineRow) {
      return [];
    }

    const customer = mapCustomerRow(customerRow);
    const { data: draftRows } = await supabase
      .from("inspections")
      .update({
        customer_id: input.customerId,
        customer_snapshot: buildCustomerSnapshot(customer)
      })
      .eq("machine_id", input.machineId)
      .eq("status", "draft")
      .select("*");

    const affectedInspectionIds: string[] = [];
    for (const row of draftRows ?? []) {
      const inspection = mapInspectionRow(row);
      affectedInspectionIds.push(inspection.id);
      const { data: attachmentRows } = await supabase
        .from("inspection_attachments")
        .select("id, kind, storage_path")
        .eq("inspection_id", inspection.id);

      await syncSupabaseInspectionDocuments(
        inspection,
        (attachmentRows ?? []).map((attachment) => ({
          id: String(attachment.id),
          kind: String(attachment.kind),
          storage_path: String(attachment.storage_path)
        }))
      );
    }

    return affectedInspectionIds;
  }

  const data = await readAppData();
  const customer = data.customers.find((item) => item.id === input.customerId);
  const machine = data.machines.find((item) => item.id === input.machineId);
  if (!customer || !machine) {
    return [];
  }

  machine.customerId = input.customerId;
  machine.updatedAt = nowIso();

  const affectedInspectionIds: string[] = [];
  for (const inspection of data.inspections) {
    if (inspection.machineId !== input.machineId || inspection.status !== "draft") {
      continue;
    }

    inspection.customerId = input.customerId;
    inspection.customerSnapshot = buildCustomerSnapshot(customer);
    inspection.updatedAt = nowIso();
    affectedInspectionIds.push(inspection.id);
    await syncDemoInspectionDocuments(data, inspection);
  }

  await writeAppData(data);
  return affectedInspectionIds;
}

export async function updateInspection(input: {
  id: string;
  inspectionDate: string;
  findings: string;
  recommendations: string;
  conclusion: string;
  status: InspectionRecord["status"];
  sendPdfToCustomer: boolean;
}) {
  const nextInspectionDate = addTwelveMonths(input.inspectionDate);

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    await supabase
      .from("inspections")
      .update({
        inspection_date: input.inspectionDate,
        next_inspection_date: nextInspectionDate,
        findings: input.findings,
        recommendations: input.recommendations,
        conclusion: input.conclusion,
        status: input.status,
        send_pdf_to_customer: input.sendPdfToCustomer
      })
      .eq("id", input.id);

    const { data: updatedRow } = await supabase
      .from("inspections")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (!updatedRow) {
      return;
    }

    const inspection = mapInspectionRow(updatedRow);
    if (inspection.status === "draft") {
      const [customer, machine] = await Promise.all([
        getCustomerById(inspection.customerId),
        getMachineById(inspection.machineId)
      ]);

      if (customer || machine) {
        const nextCustomerSnapshot = customer
          ? buildCustomerSnapshot(customer)
          : inspection.customerSnapshot;
        const nextMachineSnapshot = machine
          ? buildMachineSnapshot(machine)
          : inspection.machineSnapshot;

        await supabase
          .from("inspections")
          .update({
            customer_snapshot: nextCustomerSnapshot,
            machine_snapshot: nextMachineSnapshot
          })
          .eq("id", input.id);

        inspection.customerSnapshot = nextCustomerSnapshot;
        inspection.machineSnapshot = nextMachineSnapshot;
      }
    }

    const { data: attachmentRows } = await supabase
      .from("inspection_attachments")
      .select("id, kind, storage_path")
      .eq("inspection_id", input.id);

    await syncSupabaseInspectionDocuments(
      inspection,
      (attachmentRows ?? []).map((row) => ({
        id: String(row.id),
        kind: String(row.kind),
        storage_path: String(row.storage_path)
      }))
    );
    return;
  }

  const data = await readAppData();
  const inspection = data.inspections.find((item) => item.id === input.id);
  if (!inspection) {
    return;
  }

  inspection.inspectionDate = input.inspectionDate;
  inspection.nextInspectionDate = nextInspectionDate;
  inspection.findings = input.findings;
  inspection.recommendations = input.recommendations;
  inspection.conclusion = input.conclusion;
  inspection.status = input.status;
  inspection.sendPdfToCustomer = input.sendPdfToCustomer;
  if (inspection.status === "draft") {
    const customer = data.customers.find((item) => item.id === inspection.customerId);
    const machine = data.machines.find((item) => item.id === inspection.machineId);
    if (customer) {
      inspection.customerSnapshot = buildCustomerSnapshot(customer);
    }
    if (machine) {
      inspection.machineSnapshot = buildMachineSnapshot(machine);
    }
  }
  inspection.updatedAt = nowIso();
  await syncDemoInspectionDocuments(data, inspection);
  await writeAppData(data);
}

export async function resendInspectionMail(
  inspectionId: string,
  options?: {
    customerRecipient?: string;
    sendPdfToCustomer?: boolean;
  }
) {
  const inspection = await getInspectionById(inspectionId);
  if (!inspection) {
    throw new Error("Keuring niet gevonden");
  }

  const customer = await getCustomerById(inspection.customerId);
  if (!customer) {
    throw new Error("Klant niet gevonden");
  }

  const attachments = await getAttachmentsForInspection(inspection.id);
  const pdfAttachment = attachments.find((attachment) => attachment.kind === "pdf");
  const wordAttachment = attachments.find((attachment) => attachment.kind === "word");

  async function readAttachment(storagePath: string) {
    if (hasSupabaseConfig()) {
      const supabase = createSupabaseAdmin();
      const { data } = await supabase.storage
        .from("inspection-files")
        .download(storagePath);
      return data ? Buffer.from(await data.arrayBuffer()) : null;
    }

    return readFile(path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath));
  }

  const sendResult = await sendInspectionEmails(
    inspection,
    options?.customerRecipient || customer.email,
    customer.contactName,
    customer.companyName,
    {
      pdf:
        pdfAttachment
          ? {
              filename: pdfAttachment.fileName,
              content: (await readAttachment(pdfAttachment.storagePath)) as Buffer
            }
          : undefined,
      word:
        wordAttachment
          ? {
              filename: wordAttachment.fileName,
              content: (await readAttachment(wordAttachment.storagePath)) as Buffer
            }
          : undefined
    },
    {
      sendPdfToCustomer: options?.sendPdfToCustomer ?? inspection.sendPdfToCustomer
    }
  );

  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    await supabase.from("mail_events").insert([
      {
        inspection_id: inspection.id,
        recipient: appConfig.mailInternalTo,
        subject: `Opnieuw verzonden ${inspection.inspectionNumber}`,
        channel: "internal",
        delivery_status: sendResult.internal
      },
      ...((options?.sendPdfToCustomer ?? inspection.sendPdfToCustomer)
        ? [
            {
              inspection_id: inspection.id,
              recipient: options?.customerRecipient || customer.email,
              subject: `Opnieuw verzonden ${inspection.inspectionNumber}`,
              channel: "customer",
              delivery_status:
                sendResult.customer === "not_requested" ? "skipped" : sendResult.customer
            }
          ]
        : [])
    ]);
    return;
  }

  const data = await readAppData();
  data.mailEvents.unshift({
    id: randomUUID(),
    inspectionId: inspection.id,
    recipient: appConfig.mailInternalTo,
    subject: `Opnieuw verzonden ${inspection.inspectionNumber}`,
    channel: "internal",
    deliveryStatus: sendResult.internal,
    createdAt: nowIso()
  });
  if (options?.sendPdfToCustomer ?? inspection.sendPdfToCustomer) {
    data.mailEvents.unshift({
      id: randomUUID(),
      inspectionId: inspection.id,
      recipient: options?.customerRecipient || customer.email,
      subject: `Opnieuw verzonden ${inspection.inspectionNumber}`,
      channel: "customer",
      deliveryStatus:
        sendResult.customer === "not_requested" ? "skipped" : sendResult.customer,
      createdAt: nowIso()
    });
  }
  await writeAppData(data);
}
