type Account = { id?: string; email?: string; app_metadata?: Record<string, unknown> } | null | undefined;

export const workshopLoginEmail = "werkplaats@accounts.invalid";
export function resolveLoginIdentifier(value: string) {
  const login = value.trim().toLowerCase();
  return login === "werkplaats" ? workshopLoginEmail : login;
}
export function canManageWorkshopTablet(user: Account) {
  return !isWorkshopViewer(user) && ["info@heftrucks.frl", "info@terpstratrading.frl", "info@heftruckopleiding.frl"].includes(user?.email?.trim().toLowerCase() || "");
}

// app_metadata is assigned by the server/admin; user_metadata must never grant access.
export function isWorkshopViewer(user: Account) {
  return user?.app_metadata?.app_role === "workshop_viewer";
}

export function workshopViewerRequestAllowed(path: string, method: string) {
  if(path === "/api/werkplaats/bestellingen")return ["GET","HEAD","POST"].includes(method);
  if (method === "DELETE" && path === "/api/werkplaats/session") return true;
  if (method !== "GET" && method !== "HEAD") return false;
  return path === "/werkplaats" || path === "/werkplaats/bestellingen" || path === "/api/werkplaats" ||
    ["/werkplaats-preview/index.html", "/werkplaats-preview/assets/planning.js", "/werkplaats-preview/assets/planning.css",
      "/manifest.webmanifest", "/favicon.ico", "/favicon-32x32.png", "/app-icon-192.png", "/app-icon-512.png", "/apple-touch-icon.png"].includes(path) ||
    path.startsWith("/_next/static/") || path === "/_next/image";
}
