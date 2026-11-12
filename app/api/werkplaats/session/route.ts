import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateCsrf, validateOrigin } from "@/lib/security";

export async function DELETE(request: NextRequest) {
  const denied = validateOrigin(request) || validateCsrf(request);
  if (denied) return NextResponse.json({message:denied},{status:403});
  const client = await createClient();
  const {error} = await client.auth.signOut();
  return NextResponse.json({ok:!error},{status:error?500:200});
}
