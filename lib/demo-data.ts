import type { AppDataSnapshot } from "@/lib/domain";

const now = "2026-03-27T10:00:00.000Z";

export const demoData: AppDataSnapshot = {
  customers: [
    {
      id: "customer-1",
      companyName: "Bouwbedrijf Noord",
      address: "Havenweg 12, 8912 AB Leeuwarden",
      contactName: "Jan de Boer",
      phone: "0612345678",
      email: "jan@bouwbedrijfnoord.nl",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "customer-2",
      companyName: "Fryslan Logistiek",
      address: "Industrieterrein 8, 9101 ZX Dokkum",
      contactName: "Marije Postma",
      phone: "0687654321",
      email: "marije@fryslanlogistiek.nl",
      createdAt: now,
      updatedAt: now
    }
  ],
  machines: [
    {
      id: "machine-1",
      customerId: "customer-1",
      machineNumber: "M-1024",
      machineType: "verreiker",
      availabilityStatus: "available",
      brand: "Manitou",
      model: "VT-14",
      serialNumber: "VT14202401",
      buildYear: "2021",
      internalNumber: "M-1024",
      configuration: {},
      createdAt: now,
      updatedAt: now
    },
    {
      id: "machine-2",
      customerId: "customer-2",
      machineNumber: "M-2218",
      machineType: "heftruck_reachtruck",
      availabilityStatus: "available",
      brand: "Linde",
      model: "R25",
      serialNumber: "R25201944",
      buildYear: "2019",
      internalNumber: "M-2218",
      configuration: {},
      createdAt: now,
      updatedAt: now
    }
  ],
  inspections: [
    {
      id: "inspection-1",
      inspectionNumber: "26041",
      customerId: "customer-2",
      machineId: "machine-2",
      machineType: "heftruck_reachtruck",
      inspectionDate: "2026-03-19",
      nextInspectionDate: "2027-03-19",
      status: "approved",
      sendPdfToCustomer: true,
      customerSnapshot: {},
      machineSnapshot: {},
      checklist: {},
      findings: "Geen kritieke afwijkingen.",
      recommendations: "Jaarlijkse vervolgkeuring blijven plannen.",
      conclusion: "Goedgekeurd.",
      resultLabels: ["Goedgekeurd"],
      createdAt: now,
      updatedAt: now
    }
  ],
  planningItems: [
    {
      id: "planning-1",
      inspectionId: "inspection-1",
      customerId: "customer-2",
      machineId: "machine-2",
      dueDate: "2027-03-19",
      state: "scheduled",
      createdAt: now,
      updatedAt: now
    }
  ],
  rentals: [],
  attachments: [],
  mailEvents: []
};
