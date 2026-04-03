import { NextResponse, type NextRequest } from "next/server";
import { ensureCsrfCookie } from "@/lib/security";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  return ensureCsrfCookie(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
