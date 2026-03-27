import { randomUUID } from "node:crypto";
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
  PlanningRecord
} from "@/lib/domain";

function nowIso() {
  return new Date().toISOString();
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
    match.configuration = input.details;
    match.updatedAt = nowIso();
    return match;
  }

  const machine: MachineRecord = {
    id: randomUUID(),
    customerId,
    machineNumber: identifier,
    machineType,
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    buildYear: input.buildYear,
    internalNumber: input.internalNumber,
    configuration: input.details,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  data.machines.unshift(machine);
  return machine;
}

async function createDemoInspection(input: CreateInspectionInput) {
  const data = await readAppData();
  const customer = findOrCreateCustomer(data, input.customer);
  const machine = findOrCreateMachine(data, customer.id, input.machine, input.machineType);
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
    status: input.resultLabels.some((label) => label.toLowerCase().includes("afgekeurd"))
      ? "rejected"
      : "approved",
    sendPdfToCustomer: input.sendPdfToCustomer,
    customerSnapshot: {
      customer_name: customer.companyName,
      customer_address: customer.address,
      customer_contact: customer.contactName,
      customer_phone: customer.phone,
      customer_email: customer.email
    },
    machineSnapshot: {
      machine_number: machine.machineNumber,
      brand: machine.brand,
      model: machine.model,
      serial_number: machine.serialNumber,
      build_year: machine.buildYear,
      internal_number: machine.internalNumber,
      ...machine.configuration
    },
    checklist: input.checklist,
    findings: input.findings,
    recommendations: input.recommendations,
    conclusion: input.conclusion,
    resultLabels: input.resultLabels,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const documents = await generateInspectionDocuments(inspection, {
    persistToDisk: true
  });
  inspection.pdfPath = documents.pdfPath;
  inspection.wordPath = documents.wordPath;
  data.inspections.unshift(inspection);
  data.attachments.unshift({
    id: randomUUID(),
    inspectionId: inspection.id,
    kind: "pdf",
    fileName: documents.pdfFileName,
    storagePath: path.relative(process.cwd(), documents.pdfPath ?? "").replaceAll("\\", "/"),
    mimeType: "application/pdf",
    createdAt: nowIso()
  });
  data.attachments.unshift({
    id: randomUUID(),
    inspectionId: inspection.id,
    kind: "word",
    fileName: documents.wordFileName,
    storagePath: path.relative(process.cwd(), documents.wordPath ?? "").replaceAll("\\", "/"),
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdAt: nowIso()
  });

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

  const { data: customerRow } = await supabase
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

  const { data: machineRow } = await supabase
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
        configuration: input.machine.details
      },
      { onConflict: "machine_number" }
    )
    .select()
    .single();

  const { data: inserted } = await supabase
    .from("inspections")
    .insert({
      customer_id: customerRow?.id,
      machine_id: machineRow?.id,
      machine_type: input.machineType,
      inspection_date: input.inspectionDate,
      status: input.resultLabels.some((label) => label.toLowerCase().includes("afgekeurd"))
        ? "rejected"
        : "approved",
      send_pdf_to_customer: input.sendPdfToCustomer,
      checklist: input.checklist,
      customer_snapshot: {
        customer_name: input.customer.companyName,
        customer_address: input.customer.address,
        customer_contact: input.customer.contactName,
        customer_phone: input.customer.phone,
        customer_email: input.customer.email
      },
      machine_snapshot: {
        machine_number: input.machine.machineNumber,
        brand: input.machine.brand,
        model: input.machine.model,
        serial_number: input.machine.serialNumber,
        build_year: input.machine.buildYear,
        internal_number: input.machine.internalNumber,
        ...input.machine.details
      },
      findings: input.findings,
      recommendations: input.recommendations,
      conclusion: input.conclusion
    })
    .select()
    .single();

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

  return {
    drafts,
    inspectionsThisMonth: data.inspections.filter((item) => item.inspectionDate.startsWith("2026-03")).length,
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

export async function getMachines() {
  if (hasSupabaseConfig()) {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("machines")
      .select("*")
      .order("machine_number", { ascending: true });
    return (data ?? []).map((row) => mapMachineRow(row));
  }
  const data = await listDemoData();
  return data.machines;
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
