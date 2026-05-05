"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { getCsrfHeaders } from "@/lib/client-security";
import { fileUrl } from "@/lib/file-urls";
import type { InspectionAttachmentRecord, InspectionRecord } from "@/lib/domain";
import {
  formatMachineBrandTypeSerial,
  formatMachineKindBrandType
} from "@/lib/machine-presentation";

interface CustomerInspectionHistoryProps {
  inspections: InspectionRecord[];
  attachments: InspectionAttachmentRecord[];
}

export function CustomerInspectionHistory({
  inspections,
  attachments
}: CustomerInspectionHistoryProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resendInspectionId, setResendInspectionId] = useState("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [isPending, startTransition] = useTransition();

  function getPdfAttachment(inspectionId: string) {
    return attachments.find(
      (attachment) => attachment.inspectionId === inspectionId && attachment.kind === "pdf"
    );
  }

  function resendMail(inspectionId: string) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/inspections/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders()
        },
        body: JSON.stringify({
          inspectionId,
          customerRecipient: customRecipient.trim() || undefined,
          sendPdfToCustomer: sendToCustomer
        })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback(result?.message || "Mail opnieuw versturen is niet gelukt.");
        return;
      }

      setFeedback("Mail opnieuw verzonden.");
      setResendInspectionId("");
      setCustomRecipient("");
      setSendToCustomer(true);
      router.refresh();
    });
  }

  return (
    <>
      {feedback ? <p className="form-message success">{feedback}</p> : null}
      {resendInspectionId ? (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="eyebrow">Opnieuw mailen</div>
          <h2>Kies eerst waar de PDF heen moet</h2>
          <div className="form-block">
            <label className="status-chip">
              <input
                checked={sendToCustomer}
                onChange={() => setSendToCustomer(true)}
                type="radio"
              />
              Mail naar klant
            </label>
            <label className="status-chip">
              <input
                checked={!sendToCustomer}
                onChange={() => setSendToCustomer(false)}
                type="radio"
              />
              Mail naar ander adres
            </label>
            {!sendToCustomer ? (
              <div className="field">
                <label htmlFor="customerCardCustomRecipient">Ander e-mailadres</label>
                <input
                  id="customerCardCustomRecipient"
                  type="email"
                  value={customRecipient}
                  onChange={(event) => setCustomRecipient(event.target.value)}
                  placeholder="naam@bedrijf.nl"
                />
              </div>
            ) : null}
            <div className="actions">
              <button
                className="button"
                type="button"
                disabled={isPending}
                onClick={() => resendMail(resendInspectionId)}
              >
                {isPending ? "Bezig..." : "Verzenden"}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setResendInspectionId("")}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="table-like">
        <div className="table-row table-head">
          <span>Keurnummer</span>
          <span>Machine</span>
          <span>Datum</span>
          <span>Actie</span>
        </div>
        {inspections.map((inspection) => {
          const pdfAttachment = getPdfAttachment(inspection.id);

          return (
            <div className="table-row" key={inspection.id}>
              <span>{inspection.inspectionNumber}</span>
              <span>
                {inspection.machineType === "batterij_lader" || inspection.machineType === "stellingmateriaal"
                  ? formatMachineKindBrandType({
                      machineType: inspection.machineType,
                      brand: inspection.machineSnapshot.brand,
                      model: inspection.machineSnapshot.model,
                      configuration: inspection.machineSnapshot
                    })
                  : formatMachineBrandTypeSerial({
                      machineType: inspection.machineType,
                      brand: inspection.machineSnapshot.brand,
                      model: inspection.machineSnapshot.model,
                      serial_number: inspection.machineSnapshot.serial_number,
                      configuration: inspection.machineSnapshot
                    })}
              </span>
              <span>{inspection.inspectionDate}</span>
              <span>
                {pdfAttachment ? (
                  <>
                    <a
                      className="button-secondary"
                      href={fileUrl(pdfAttachment.storagePath)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Rapport openen
                    </a>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setFeedback(null);
                        setResendInspectionId(inspection.id);
                      }}
                    >
                      Mail
                    </button>
                  </>
                ) : (
                  <span
                    className={`badge ${
                      inspection.status === "rejected"
                        ? "orange"
                        : inspection.status === "draft"
                          ? "orange"
                          : "green"
                    }`}
                  >
                    {inspection.status === "rejected"
                      ? "Afgekeurd"
                      : inspection.status === "draft"
                        ? "In behandeling"
                        : "Goedgekeurd"}
                  </span>
                )}
                <Link
                  className="button-secondary"
                  href={
                    (inspection.status === "draft"
                      ? `/keuringen/nieuw?inspectionId=${inspection.id}`
                      : `/keuringen/${inspection.id}`) as Route
                  }
                >
                  Keuring openen
                </Link>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
