import { NextResponse, type NextRequest } from "next/server";
import { requireActivityActor } from "@/lib/auth";
import { addActivityLog, resendInspectionMail } from "@/lib/inspection-service";
import {
  applyRateLimit,
  isValidEmailAddress,
  validateCsrf,
  validateOrigin
} from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const originError = validateOrigin(request);
    if (originError) {
      return NextResponse.json({ ok: false, message: originError }, { status: 403 });
    }

    const csrfError = validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ ok: false, message: csrfError }, { status: 403 });
    }

    const rateLimitError = applyRateLimit(request, "inspection-resend", 5);
    if (rateLimitError) {
      return NextResponse.json({ ok: false, message: rateLimitError }, { status: 429 });
    }

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

    if (
      body.customerRecipient &&
      !isValidEmailAddress(body.customerRecipient)
    ) {
      return NextResponse.json(
        { ok: false, message: "Vul een geldig e-mailadres in." },
        { status: 400 }
      );
    }

    const customRecipient = body.customerRecipient?.trim() || undefined;
    const shouldSendPdf =
      customRecipient !== undefined ? true : Boolean(body.sendPdfToCustomer);

    await resendInspectionMail(body.inspectionId, {
      customerRecipient: customRecipient,
      sendPdfToCustomer: shouldSendPdf
    });

    const actor = await requireActivityActor();
    await addActivityLog({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "inspection.resent",
      entityType: "inspection",
      entityId: body.inspectionId,
      targetLabel: `Keuring ${body.inspectionId}`,
      details: {
        customerRecipient: customRecipient ?? null,
        sendPdfToCustomer: shouldSendPdf
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Mail opnieuw versturen is niet gelukt."
      },
      { status: 500 }
    );
  }
}
