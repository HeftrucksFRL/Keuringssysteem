import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { compressImageToTarget } from "@/lib/image-upload";
import { hasSupabaseConfig } from "@/lib/env";
import type { InspectionAttachmentRecord } from "@/lib/domain";

function sanitizedName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function storeInspectionPhoto(
  inspectionId: string,
  photo: { fileName: string; contentType: string; buffer: Buffer }
) {
  const compressed = await compressImageToTarget(photo.buffer, 300);
  const fileName = `${Date.now()}-${sanitizedName(photo.fileName || "photo.jpg")}`.replace(
    /\.(png|webp|jpeg)$/i,
    ".jpg"
  );

  if (!hasSupabaseConfig) {
    const relativePath = path.join("uploads", "inspections", inspectionId, fileName);
    const absolutePath = path.join(process.cwd(), relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, compressed);

    const attachment: InspectionAttachmentRecord = {
      id: randomUUID(),
      inspectionId,
      kind: "photo",
      fileName,
      storagePath: relativePath.replaceAll("\\", "/"),
      mimeType: "image/jpeg",
      createdAt: new Date().toISOString()
    };

    return attachment;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
  const storagePath = `inspections/${inspectionId}/photos/${fileName}`;

  await supabase.storage.from("inspection-files").upload(storagePath, compressed, {
    upsert: true,
    contentType: "image/jpeg"
  });

  const { data } = await supabase
    .from("inspection_attachments")
    .insert({
      inspection_id: inspectionId,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "image/jpeg",
      kind: "photo"
    })
    .select()
    .single();

  return {
    id: String(data?.id ?? randomUUID()),
    inspectionId,
    kind: "photo" as const,
    fileName,
    storagePath,
    mimeType: "image/jpeg",
    createdAt: String(data?.created_at ?? new Date().toISOString())
  };
}
