import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { demoData } from "@/lib/demo-data";
import type { AppDataSnapshot } from "@/lib/domain";

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "demo-db.json");

export async function readAppData(): Promise<AppDataSnapshot> {
  if (!existsSync(dataFile)) {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFile, JSON.stringify(demoData, null, 2), "utf8");
    return demoData;
  }

  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppDataSnapshot>;

  return {
    customers: parsed.customers ?? demoData.customers,
    customerContacts: parsed.customerContacts ?? demoData.customerContacts,
    machines: parsed.machines ?? demoData.machines,
    inspections: parsed.inspections ?? demoData.inspections,
    planningItems: parsed.planningItems ?? demoData.planningItems,
    rentals: parsed.rentals ?? demoData.rentals,
    attachments: parsed.attachments ?? [],
    mailEvents: parsed.mailEvents ?? demoData.mailEvents
  };
}

export async function writeAppData(data: AppDataSnapshot) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}
