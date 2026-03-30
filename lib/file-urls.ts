import { hasPublicSupabaseConfig } from "@/lib/env";

export function fileUrl(storagePath: string) {
  const search = new URLSearchParams({
    kind: hasPublicSupabaseConfig() ? "storage" : "local",
    path: storagePath
  });

  return `/api/files?${search.toString()}`;
}

export function downloadUrl(storagePath: string) {
  const search = new URLSearchParams({
    kind: hasPublicSupabaseConfig() ? "storage" : "local",
    path: storagePath,
    download: "1"
  });

  return `/api/files?${search.toString()}`;
}
