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
  const [customerFilter, setCustomerFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resendInspectionId, setResendInspectionId] = useState<string>("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [isPending, startTransition] = useTransition();

  const customerOptions = useMemo(
    () =>
      customers
        .map((customer) => ({ id: customer.id, label: customer.companyName }))
        .sort((left, right) => left.label.localeCompare(right.label, "nl")),
    [customers]
  );

  const machineOptions = useMemo(
    () =>
      machines
        .map((machine) => ({
          id: machine.id,
          label: [machine.internalNumber || machine.machineNumber, machine.brand, machine.model]
            .filter(Boolean)
            .join(" ")
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "nl")),
    [machines]
  );

  const filteredInspections = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...inspections]
      .sort((left, right) => {
        const leftNumber = Number(left.inspectionNumber);
        const rightNumber = Number(right.inspectionNumber);

        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
          return rightNumber - leftNumber;
        }

        return right.inspectionNumber.localeCompare(left.inspectionNumber, "nl");
      })
      .filter((inspection) => {
        const customer = customers.find((item) => item.id === inspection.customerId);
        const machine = machines.find((item) => item.id === inspection.machineId);

        if (customerFilter && inspection.customerId !== customerFilter) {
          return false;
        }

        if (machineFilter && inspection.machineId !== machineFilter) {
          return false;
        }

        if (dateFilter && inspection.inspectionDate !== dateFilter) {
          return false;
        }

        if (!needle) {
          return true;
        }

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
  }, [customerFilter, customers, dateFilter, inspections, machineFilter, machines, query]);

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
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="inspection-customer-filter">Klant</label>
          <select
            id="inspection-customer-filter"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
          >
            <option value="">Alle klanten</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="inspection-machine-filter">Machine</label>
          <select
            id="inspection-machine-filter"
            value={machineFilter}
            onChange={(event) => setMachineFilter(event.target.value)}
          >
            <option value="">Alle machines</option>
            {machineOptions.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="inspection-date-filter">Datum</label>
          <input
            id="inspection-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </div>
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
              </strong>
              <span>
                {customer?.companyName ?? "-"} · {machine?.brand ?? "Machine"} {machine?.model ?? ""}
              </span>
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
