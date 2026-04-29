import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCustomerContacts } from "@/lib/inspection-service";
import { applyRateLimit, validateOrigin } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originError = validateOrigin(request);
  if (originError) {
    return NextResponse.json({ ok: false, message: originError }, { status: 403 });
  }

  const rateLimitError = applyRateLimit(request, "customer-contacts", 180);
  if (rateLimitError) {
    return NextResponse.json({ ok: false, message: rateLimitError }, { status: 429 });
  }

  await requireUser();
  const { id } = await params;
  const contacts = await getCustomerContacts(id);

  return NextResponse.json({ ok: true, contacts });
}
