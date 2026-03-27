import type { MachineType, ChecklistOption } from "@/lib/types";

export interface CustomerRecord {
  id: string;
  companyName: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineRecord {
  id: string;
  customerId: string;
  machineNumber: string;
  machineType: MachineType;
  brand: string;
  model: string;
  serialNumber: string;
  buildYear: string;
  internalNumber: string;
  configuration: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionRecord {
  id: string;
  inspectionNumber: string;
  customerId: string;
  machineId: string;
  machineType: MachineType;
  inspectionDate: string;
  nextInspectionDate: string;
  status: "draft" | "completed" | "approved" | "rejected";
  sendPdfToCustomer: boolean;
  customerSnapshot: Record<string, string>;
  machineSnapshot: Record<string, string>;
  checklist: Record<string, ChecklistOption>;
  findings: string;
  recommendations: string;
  conclusion: string;
  resultLabels: string[];
  pdfPath?: string;
  wordPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningRecord {
  id: string;
  inspectionId: string;
  customerId: string;
  machineId: string;
  dueDate: string;
  state: "upcoming" | "overdue" | "scheduled" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface InspectionAttachmentRecord {
  id: string;
  inspectionId: string;
  kind: "photo" | "pdf" | "word";
  fileName: string;
  storagePath: string;
  mimeType: string;
  createdAt: string;
}

export interface MailEventRecord {
  id: string;
  inspectionId: string;
  recipient: string;
  subject: string;
  channel: "internal" | "customer";
  deliveryStatus: "queued" | "sent" | "skipped" | "failed";
  createdAt: string;
}

export interface AppDataSnapshot {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
  planningItems: PlanningRecord[];
  attachments: InspectionAttachmentRecord[];
  mailEvents: MailEventRecord[];
}

export interface CreateInspectionInput {
  machineType: MachineType;
  customer: {
    companyName: string;
    address: string;
    contactName: string;
    phone: string;
    email: string;
  };
  machine: {
    machineNumber: string;
    brand: string;
    model: string;
    serialNumber: string;
    buildYear: string;
    internalNumber: string;
    details: Record<string, string>;
  };
  inspectionDate: string;
  checklist: Record<string, ChecklistOption>;
  findings: string;
  recommendations: string;
  conclusion: string;
  resultLabels: string[];
  sendPdfToCustomer: boolean;
  photos: Array<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }>;
}
