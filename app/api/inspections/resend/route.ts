import { NextResponse } from "next/server";
import { resendInspectionMail } from "@/lib/inspection-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      inspectionId?: string;
      customerRecipient?: string;
      sendPdfToCustomer?: boolean;
    };

    if (!body.inspectionId) {
      return NextResponse.json(
        { ok: false, message: "Geen keuring gekozen." },
        { status: 400 }
      );
    }

    await resendInspectionMail(body.inspectionId, {
      customerRecipient: body.customerRecipient,
      sendPdfToCustomer: body.sendPdfToCustomer
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Mail opnieuw versturen is niet gelukt." },
      { status: 500 }
    );
  }
}
