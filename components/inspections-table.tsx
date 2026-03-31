"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fileUrl } from "@/lib/file-urls";
import type {
  CustomerRecord,
  InspectionAttachmentRecord,
  InspectionRecord,
  MachineRecord
} from "@/lib/domain";

interface InspectionsTableProps {
  inspections: InspectionRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
  attachments: InspectionAttachmentRecord[];
}

export function InspectionsTable({
  inspections,
  customers,
  machines,
  attachments
}: InspectionsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resendInspectionId, setResendInspectionId] = useState<string>("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [isPending, startTransition] = useTransition();

  const filteredInspections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return inspections;
    }

    return inspections.filter((inspection) => {
      const customer = customers.find((item) => item.id === inspection.customerId);
      const machine = machines.find((item) => item.id === inspection.machineId);

      return [
        inspection.inspectionNumber,
        inspection.inspectionDate,
        customer?.companyName,
        machine?.internalNumber,
        machine?.brand,
        machine?.model
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [customers, inspections, machines, query]);

  function resendMail(inspectionId: string) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/inspections/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId,
          customerRecipient: customRecipient.trim() || undefined,
          sendPdfToCustomer: sendToCustomer
        })
      });

      if (!response.ok) {
        setFeedback("Mail opnieuw versturen is niet gelukt.");
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
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op keurnummer, klant of machine"
        />
      </div>
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
                <label htmlFor="customRecipient">Ander e-mailadres</label>
                <input
                  id="customRecipient"
                  type="email"
                  value={customRecipient}
                  onChange={(event) => setCustomRecipient(event.target.value)}
                  placeholder="naam@bedrijf.nl"
                />
              </div>
            ) : null}
            <div className="actions">
              <button className="button" type="button" disabled={isPending} onClick={() => resendMail(resendInspectionId)}>
                {isPending ? "Bezig..." : "Verzenden"}
              </button>
              <button className="button-secondary" type="button" onClick={() => setResendInspectionId("")}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="dataset-list">
        {filteredInspections.map((inspection) => {
          const customer = customers.find((item) => item.id === inspection.customerId);
          const machine = machines.find((item) => item.id === inspection.machineId);
          const pdfAttachment = attachments.find(
            (attachment) => attachment.inspectionId === inspection.id && attachment.kind === "pdf"
          );
          const statusClass =
            inspection.status === "rejected"
              ? "red"
              : inspection.status === "draft"
                ? "orange"
                : "green";

          return (
            <div className="dataset-row" key={inspection.id}>
              <strong>
                <span className={`status-dot ${statusClass}`} aria-hidden="true" />
                {inspection.inspectionNumber}
              <span>
                {customer?.companyName ?? "-"} · {machine?.brand ?? "Machine"} {machine?.model ?? ""}
              </span>
              </strong>
              <span>{inspection.inspectionDate}</span>
              <span className="inline-meta">
                {pdfAttachment ? (
                  <a
                    className="button-secondary"
                    href={fileUrl(pdfAttachment.storagePath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Rapport openen
                  </a>
                ) : null}
                <Link className="button-secondary" href={`/keuringen/${inspection.id}`}>
                  Keuring openen
                </Link>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setFeedback(null);
                    setResendInspectionId(inspection.id);
                  }}
                >
                  Opnieuw mailen
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
