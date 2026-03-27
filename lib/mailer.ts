import { Resend } from "resend";
import { appConfig } from "@/lib/env";
import { buildCustomerMail, buildInternalMail } from "@/lib/mail";
import type { InspectionRecord } from "@/lib/domain";

interface MailAttachment {
  filename: string;
  content: Buffer;
}

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

export async function sendInspectionEmails(
  inspection: InspectionRecord,
  customerEmail: string,
  customerName: string,
  companyName: string,
  files?: {
    pdf?: MailAttachment;
    word?: MailAttachment;
  }
) {
  const resend = createResendClient();
  if (!resend) {
    return {
      internal: "skipped" as const,
      customer: inspection.sendPdfToCustomer ? ("skipped" as const) : ("not_requested" as const)
    };
  }

  const internalMail = buildInternalMail(companyName, inspection.inspectionNumber);
  const attachments = files?.word ? [files.word] : [];

  await resend.emails.send({
    from: appConfig.mailFrom,
    replyTo: appConfig.mailReplyTo,
    to: [appConfig.mailInternalTo],
    subject: internalMail.subject,
    text: internalMail.text,
    attachments
  });

  let customerStatus: "sent" | "skipped" | "not_requested" = "not_requested";

  if (inspection.sendPdfToCustomer && customerEmail && files?.pdf) {
    const customerMail = buildCustomerMail(customerName);
    await resend.emails.send({
      from: appConfig.mailFrom,
      replyTo: appConfig.mailReplyTo,
      to: [customerEmail],
      subject: customerMail.subject,
      html: customerMail.html,
      attachments: [files.pdf]
    });
    customerStatus = "sent";
  }

  return {
    internal: "sent" as const,
    customer: customerStatus
  };
}
