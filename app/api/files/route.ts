import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/env";

function resolveLocalPath(target: string) {
  const absolutePath = path.isAbsolute(target)
    ? target
    : path.join(process.cwd(), target);
  const normalized = path.normalize(absolutePath);

  if (!normalized.startsWith(path.normalize(process.cwd()))) {
    return null;
  }

  return normalized;
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const targetPath = request.nextUrl.searchParams.get("path");
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!kind || !targetPath) {
    return new NextResponse("Bestand niet gevonden.", { status: 404 });
  }

  if (kind === "local") {
    const absolutePath = resolveLocalPath(targetPath);
    if (!absolutePath) {
      return new NextResponse("Ongeldig pad.", { status: 400 });
    }

    const content = await readFile(absolutePath);
    const mimeType = targetPath.endsWith(".pdf")
      ? "application/pdf"
      : targetPath.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "image/jpeg";

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${path.basename(
          targetPath
        )}"`
      }
    });
  }

  if (kind === "storage" && hasSupabaseConfig()) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    );
    const { data, error } = await supabase.storage
      .from("inspection-files")
      .download(targetPath);

    if (error || !data) {
      return new NextResponse("Bestand niet gevonden.", { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type":
          data.type ||
          (targetPath.endsWith(".pdf")
            ? "application/pdf"
            : targetPath.endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "image/jpeg"),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${path.basename(
          targetPath
        )}"`
      }
    });
  }

  return new NextResponse("Bestand niet beschikbaar.", { status: 404 });
}
