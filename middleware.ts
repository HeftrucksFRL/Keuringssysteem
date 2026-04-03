import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig } from "@/lib/env";
import { ensureCsrfCookie } from "@/lib/security";

export async function middleware(request: NextRequest) {
  let response = ensureCsrfCookie(request, NextResponse.next());

  if (!hasSupabaseConfig()) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string } & CookieOptions>) {
          cookiesToSet.forEach(({ name, value, ...options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isApiRoute) {
    return NextResponse.json({ ok: false, message: "Log eerst in om verder te gaan." }, { status: 401 });
  }

  if (!user && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return ensureCsrfCookie(request, NextResponse.redirect(loginUrl));
  }

  if (user && isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return ensureCsrfCookie(request, NextResponse.redirect(homeUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
