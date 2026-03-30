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
      <div className="table-like">
        <div className="table-row table-head">
          <span>Keurnummer</span>
          <span>Klant / machine</span>
          <span>Datum</span>
          <span>Acties</span>
        </div>
        {filteredInspections.map((inspection) => {
          const customer = customers.find((item) => item.id === inspection.customerId);
          const machine = machines.find((item) => item.id === inspection.machineId);
          const pdfAttachment = attachments.find(
            (attachment) => attachment.inspectionId === inspection.id && attachment.kind === "pdf"
          );

          return (
            <div className="table-row" key={inspection.id}>
              <span>
                <Link href={`/keuringen/${inspection.id}`}>{inspection.inspectionNumber}</Link>
              </span>
              <span>
                <strong>{customer?.companyName ?? "-"}</strong>
                <br />
                {machine?.brand ?? "Machine"} {machine?.model ?? ""}
              </span>
              <span>{inspection.inspectionDate}</span>
              <span className="inline-meta">
                <span className={`badge ${inspection.status === "rejected" ? "orange" : "green"}`}>
                  {inspection.status === "rejected" ? "Afgekeurd" : "Goedgekeurd"}
                </span>
                {pdfAttachment ? (
                  <a
                    className="button-secondary"
                    href={fileUrl(pdfAttachment.storagePath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                ) : null}
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
