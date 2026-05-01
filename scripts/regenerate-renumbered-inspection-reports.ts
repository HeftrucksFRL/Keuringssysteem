import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateInspectionDocuments } from "../lib/documents";
import type { InspectionRecord } from "../lib/domain";

const START_NUMBER = 20260244;
const END_NUMBER = 20260255;

type AttachmentRow = {
  id: string;
  inspection_id: string;
  kind: "pdf" | "word";
  storage_path: string;
};

async function loadEnv() {
  const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function mapInspectionRow(row: Record<string, unknown>): InspectionRecord {
  return {
    id: String(row.id),
    inspectionNumber: String(row.inspection_number ?? ""),
    customerId: String(row.customer_id),
    machineId: String(row.machine_id),
    machineType: String(row.machine_type) as InspectionRecord["machineType"],
    inspectionDate: String(row.inspection_date ?? ""),
    nextInspectionDate: String(row.next_inspection_date ?? ""),
    status: String(row.status ?? "completed") as InspectionRecord["status"],
    sendPdfToCustomer: Boolean(row.send_pdf_to_customer),
    customerSnapshot: (row.customer_snapshot as Record<string, string>) ?? {},
    machineSnapshot: (row.machine_snapshot as Record<string, string>) ?? {},
    checklist: (row.checklist as InspectionRecord["checklist"]) ?? {},
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

async function main() {
  await loadEnv();
  const apply = hasFlag("--apply");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: rows, error: rowsError } = await supabase
    .from("inspections")
    .select("*")
    .gte("inspection_number", START_NUMBER)
    .lte("inspection_number", END_NUMBER)
    .order("inspection_number", { ascending: true });

  if (rowsError) {
    throw new Error(`Keuringen ophalen mislukt: ${rowsError.message}`);
  }

  const inspections = (rows ?? []).map((row) => mapInspectionRow(row));
  console.table(
    inspections.map((inspection) => ({
      number: inspection.inspectionNumber,
      date: inspection.inspectionDate,
      type: inspection.machineType
    }))
  );
  console.log(`Rapporten in scope: ${inspections.length}`);

  if (!apply) {
    return;
  }

  const { data: attachmentRows, error: attachmentError } = await supabase
    .from("inspection_attachments")
    .select("id, inspection_id, kind, storage_path")
    .in(
      "inspection_id",
      inspections.map((inspection) => inspection.id)
    )
    .in("kind", ["pdf", "word"]);

  if (attachmentError) {
    throw new Error(`Bijlagen ophalen mislukt: ${attachmentError.message}`);
  }

  const attachmentsByInspectionId = new Map<string, AttachmentRow[]>();
  for (const attachment of (attachmentRows ?? []) as AttachmentRow[]) {
    const current = attachmentsByInspectionId.get(attachment.inspection_id) ?? [];
    current.push(attachment);
    attachmentsByInspectionId.set(attachment.inspection_id, current);
  }

  for (const inspection of inspections) {
    const documents = await generateInspectionDocuments(inspection);
    const yearPrefix = inspection.inspectionDate.slice(0, 4) || "onbekend";
    const versionToken = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const pdfStoragePath = `${yearPrefix}/${inspection.inspectionNumber}/${inspection.inspectionNumber}-${versionToken}.pdf`;
    const wordStoragePath = `${yearPrefix}/${inspection.inspectionNumber}/${inspection.inspectionNumber}-${versionToken}.docx`;

    await supabase.storage.from("inspection-files").upload(pdfStoragePath, documents.pdfBuffer, {
      upsert: true,
      contentType: "application/pdf"
    });
    await supabase.storage.from("inspection-files").upload(wordStoragePath, documents.wordBuffer, {
      upsert: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const { error: inspectionError } = await supabase
      .from("inspections")
      .update({
        pdf_path: pdfStoragePath,
        word_path: wordStoragePath
      })
      .eq("id", inspection.id);

    if (inspectionError) {
      throw new Error(`${inspection.inspectionNumber}: rapportpaden opslaan mislukt.`);
    }

    const existing = attachmentsByInspectionId.get(inspection.id) ?? [];
    const pdfAttachment = existing.find((attachment) => attachment.kind === "pdf");
    const wordAttachment = existing.find((attachment) => attachment.kind === "word");

    if (pdfAttachment) {
      const { error } = await supabase
        .from("inspection_attachments")
        .update({
          storage_path: pdfStoragePath,
          file_name: documents.pdfFileName,
          mime_type: "application/pdf"
        })
        .eq("id", pdfAttachment.id);
      if (error) throw new Error(`${inspection.inspectionNumber}: pdf-bijlage bijwerken mislukt.`);
    } else {
      const { error } = await supabase.from("inspection_attachments").insert({
        inspection_id: inspection.id,
        storage_path: pdfStoragePath,
        file_name: documents.pdfFileName,
        mime_type: "application/pdf",
        kind: "pdf"
      });
      if (error) throw new Error(`${inspection.inspectionNumber}: pdf-bijlage aanmaken mislukt.`);
    }

    if (wordAttachment) {
      const { error } = await supabase
        .from("inspection_attachments")
        .update({
          storage_path: wordStoragePath,
          file_name: documents.wordFileName,
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        })
        .eq("id", wordAttachment.id);
      if (error) throw new Error(`${inspection.inspectionNumber}: word-bijlage bijwerken mislukt.`);
    } else {
      const { error } = await supabase.from("inspection_attachments").insert({
        inspection_id: inspection.id,
        storage_path: wordStoragePath,
        file_name: documents.wordFileName,
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        kind: "word"
      });
      if (error) throw new Error(`${inspection.inspectionNumber}: word-bijlage aanmaken mislukt.`);
    }

    const stalePaths = existing
      .map((attachment) => attachment.storage_path)
      .filter((storagePath) => storagePath !== pdfStoragePath && storagePath !== wordStoragePath);

    if (stalePaths.length > 0) {
      await supabase.storage.from("inspection-files").remove(stalePaths);
    }

    console.log(`${inspection.inspectionNumber}: rapporten bijgewerkt.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
