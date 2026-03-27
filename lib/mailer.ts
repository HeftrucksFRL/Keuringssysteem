import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { appConfig } from "@/lib/env";
import { buildCustomerMail, buildInternalMail } from "@/lib/mail";
import type { InspectionRecord } from "@/lib/domain";

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

async function buildAttachment(filePath: string) {
  const content = await readFile(filePath);
  return {
    filename: path.basename(filePath),
    content
  };
}

export async function sendInspectionEmails(
  inspection: InspectionRecord,
  customerEmail: string,
  customerName: string,
  companyName: string
) {
  const resend = createResendClient();
  if (!resend) {
    return {
      internal: "skipped" as const,
      customer: inspection.sendPdfToCustomer ? ("skipped" as const) : ("not_requested" as const)
    };
  }

  const internalMail = buildInternalMail(companyName, inspection.inspectionNumber);
  const attachments = [];

  if (inspection.wordPath) {
    attachments.push(await buildAttachment(inspection.wordPath));
  }

  await resend.emails.send({
    from: appConfig.mailFrom,
    replyTo: appConfig.mailReplyTo,
    to: [appConfig.mailInternalTo],
    subject: internalMail.subject,
    text: internalMail.text,
    attachments
  });

  let customerStatus: "sent" | "skipped" | "not_requested" = "not_requested";

  if (inspection.sendPdfToCustomer && customerEmail && inspection.pdfPath) {
    const customerMail = buildCustomerMail(customerName);
    await resend.emails.send({
      from: appConfig.mailFrom,
      replyTo: appConfig.mailReplyTo,
      to: [customerEmail],
      subject: customerMail.subject,
      html: customerMail.html,
      attachments: [await buildAttachment(inspection.pdfPath)]
    });
    customerStatus = "sent";
  }

  return {
    internal: "sent" as const,
    customer: customerStatus
  };
}
