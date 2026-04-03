import { NextResponse, type NextRequest } from "next/server";

export const csrfCookieName = "ks_csrf";
export const csrfHeaderName = "x-csrf-token";
const tenMinutesMs = 10 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function rateLimitStore() {
  const globalStore = globalThis as typeof globalThis & {
    __keuringssysteemRateLimit?: Map<string, RateLimitEntry>;
  };

  if (!globalStore.__keuringssysteemRateLimit) {
    globalStore.__keuringssysteemRateLimit = new Map();
  }

  return globalStore.__keuringssysteemRateLimit;
}

function normalizeOrigin(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\/$/, "");
}

function allowedOriginFromRequest(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
}

export function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(csrfCookieName)?.value) {
    return response;
  }

  response.cookies.set({
    name: csrfCookieName,
    value: crypto.randomUUID(),
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/"
  });

  return response;
}

export function validateOrigin(request: NextRequest) {
  const allowedOrigin = allowedOriginFromRequest(request);
  const origin = normalizeOrigin(request.headers.get("origin"));
  const referer = normalizeOrigin(request.headers.get("referer"));

  if (origin && origin !== allowedOrigin) {
    return "Request komt niet van het juiste domein.";
  }

  if (!origin && referer && !referer.startsWith(allowedOrigin)) {
    return "Request komt niet van het juiste domein.";
  }

  return null;
}

export function validateCsrf(request: NextRequest) {
  const cookieToken = request.cookies.get(csrfCookieName)?.value?.trim();
  const headerToken = request.headers.get(csrfHeaderName)?.trim();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return "Beveiligingscontrole mislukt. Vernieuw de pagina en probeer het opnieuw.";
  }

  return null;
}

export function applyRateLimit(
  request: NextRequest,
  keyPrefix: string,
  limit: number,
  windowMs = tenMinutesMs
) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const key = `${keyPrefix}:${clientIp}`;
  const now = Date.now();
  const store = rateLimitStore();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    return "Te veel verzoeken in korte tijd. Wacht even en probeer het daarna opnieuw.";
  }

  entry.count += 1;
  store.set(key, entry);
  return null;
}

export function isValidEmailAddress(value?: string | null) {
  const email = (value ?? "").trim();
  if (!email || email.length > 254) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
