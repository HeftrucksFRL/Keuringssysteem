import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateInspectionDocuments } from "../lib/documents";
import type { InspectionRecord } from "../lib/domain";

interface AttachmentRow {
  id: string;
  inspection_id: string;
  kind: string;
  storage_path: string;
}

function nowIso() {
  return new Date().toISOString();
}

async function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = await fs.readFile(envPath, "utf8");

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

function attachmentKey(row: AttachmentRow) {
  return `${row.inspection_id}:${row.kind}`;
}

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase omgevingsvariabelen ontbreken in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [inspectionRows, attachmentRows] = await Promise.all([
    supabase.from("inspections").select("*").order("inspection_date", { ascending: true }),
    supabase
      .from("inspection_attachments")
      .select("id, inspection_id, kind, storage_path")
      .in("kind", ["pdf", "word"])
  ]);

  if (inspectionRows.error) {
    throw new Error(`Keuringen ophalen mislukt: ${inspectionRows.error.message}`);
  }

  if (attachmentRows.error) {
    throw new Error(`Bijlagen ophalen mislukt: ${attachmentRows.error.message}`);
  }

  const inspections = (inspectionRows.data ?? []).map((row) => mapInspectionRow(row));
  const attachments = (attachmentRows.data ?? []).map((row) => ({
    id: String(row.id),
    inspection_id: String(row.inspection_id),
    kind: String(row.kind),
    storage_path: String(row.storage_path ?? "")
  }));

  const attachmentsByInspectionId = new Map<string, AttachmentRow[]>();
  attachments.forEach((attachment) => {
    const rows = attachmentsByInspectionId.get(attachment.inspection_id) ?? [];
    rows.push(attachment);
    attachmentsByInspectionId.set(attachment.inspection_id, rows);
  });

  const summary = {
    total: inspections.length,
    generated: 0,
    failed: 0,
    pdfAttachmentsCreated: 0,
    pdfAttachmentsUpdated: 0,
    wordAttachmentsCreated: 0,
    wordAttachmentsUpdated: 0
  };

  for (let index = 0; index < inspections.length; index += 1) {
    const inspection = inspections[index];

    try {
      const documents = await generateInspectionDocuments(inspection);
      const yearPrefix = inspection.inspectionDate.slice(0, 4) || "onbekend";
      const versionToken = (inspection.updatedAt || nowIso()).replace(/[^0-9]/g, "").slice(0, 14);
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

      const { error: updateInspectionError } = await supabase
        .from("inspections")
        .update({
          pdf_path: pdfStoragePath,
          word_path: wordStoragePath
        })
        .eq("id", inspection.id);

      if (updateInspectionError) {
        throw new Error(`Keuring ${inspection.inspectionNumber}: paden opslaan mislukt: ${updateInspectionError.message}`);
      }

      const existingAttachments = attachmentsByInspectionId.get(inspection.id) ?? [];
      const pdfAttachment = existingAttachments.find((attachment) => attachment.kind === "pdf");
      const wordAttachment = existingAttachments.find((attachment) => attachment.kind === "word");

      if (pdfAttachment) {
        const { error } = await supabase
          .from("inspection_attachments")
          .update({
            storage_path: pdfStoragePath,
            file_name: documents.pdfFileName,
            mime_type: "application/pdf"
          })
          .eq("id", pdfAttachment.id);

        if (error) {
          throw new Error(`Keuring ${inspection.inspectionNumber}: pdf-bijlage bijwerken mislukt: ${error.message}`);
        }

        pdfAttachment.storage_path = pdfStoragePath;
        summary.pdfAttachmentsUpdated += 1;
      } else {
        const { data, error } = await supabase
          .from("inspection_attachments")
          .insert({
            inspection_id: inspection.id,
            storage_path: pdfStoragePath,
            file_name: documents.pdfFileName,
            mime_type: "application/pdf",
            kind: "pdf"
          })
          .select("id, inspection_id, kind, storage_path")
          .single();

        if (error || !data) {
          throw new Error(`Keuring ${inspection.inspectionNumber}: pdf-bijlage aanmaken mislukt: ${error?.message ?? "onbekende fout"}`);
        }

        existingAttachments.push({
          id: String(data.id),
          inspection_id: String(data.inspection_id),
          kind: String(data.kind),
          storage_path: String(data.storage_path ?? "")
        });
        attachmentsByInspectionId.set(inspection.id, existingAttachments);
        summary.pdfAttachmentsCreated += 1;
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

        if (error) {
          throw new Error(`Keuring ${inspection.inspectionNumber}: word-bijlage bijwerken mislukt: ${error.message}`);
        }

        wordAttachment.storage_path = wordStoragePath;
        summary.wordAttachmentsUpdated += 1;
      } else {
        const { data, error } = await supabase
          .from("inspection_attachments")
          .insert({
            inspection_id: inspection.id,
            storage_path: wordStoragePath,
            file_name: documents.wordFileName,
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            kind: "word"
          })
          .select("id, inspection_id, kind, storage_path")
          .single();

        if (error || !data) {
          throw new Error(`Keuring ${inspection.inspectionNumber}: word-bijlage aanmaken mislukt: ${error?.message ?? "onbekende fout"}`);
        }

        existingAttachments.push({
          id: String(data.id),
          inspection_id: String(data.inspection_id),
          kind: String(data.kind),
          storage_path: String(data.storage_path ?? "")
        });
        attachmentsByInspectionId.set(inspection.id, existingAttachments);
        summary.wordAttachmentsCreated += 1;
      }

      const stalePaths = existingAttachments
        .map((attachment) => attachment.storage_path)
        .filter(
          (storagePath) => storagePath !== pdfStoragePath && storagePath !== wordStoragePath
        );

      if (stalePaths.length > 0) {
        await supabase.storage.from("inspection-files").remove(stalePaths);
      }

      summary.generated += 1;

      if ((index + 1) % 25 === 0 || index === inspections.length - 1) {
        console.log(`[${index + 1}/${inspections.length}] rapporten bijgewerkt`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(
        error instanceof Error
          ? error.message
          : `Keuring ${inspection.inspectionNumber}: onbekende fout`
      );
    }
  }

  console.log("Bulk rapportgeneratie afgerond.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
