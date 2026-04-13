"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCsrfHeaders } from "@/lib/client-security";
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

interface InspectionMonthGroup {
  monthKey: string;
  monthLabel: string;
  inspections: InspectionRecord[];
}

interface InspectionYearGroup {
  year: string;
  months: InspectionMonthGroup[];
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!parsedYear || !parsedMonth) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric"
  }).format(new Date(parsedYear, parsedMonth - 1, 1));
}

function groupInspectionsByYearAndMonth(
  inspections: InspectionRecord[]
): InspectionYearGroup[] {
  const yearMap = new Map<string, Map<string, InspectionRecord[]>>();

  inspections.forEach((inspection) => {
    const monthKey = inspection.inspectionDate?.slice(0, 7) || "Onbekend";
    const yearKey = monthKey.slice(0, 4) || "Onbekend";

    if (!yearMap.has(yearKey)) {
      yearMap.set(yearKey, new Map<string, InspectionRecord[]>());
    }

    const monthMap = yearMap.get(yearKey)!;
    const rows = monthMap.get(monthKey) ?? [];
    rows.push(inspection);
    monthMap.set(monthKey, rows);
  });

  return Array.from(yearMap.entries())
    .sort(([left], [right]) => right.localeCompare(left, "nl"))
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([left], [right]) => right.localeCompare(left, "nl"))
        .map(([monthKey, rows]) => ({
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          inspections: rows
        }))
    }));
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

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const machineById = useMemo(
    () => new Map(machines.map((machine) => [machine.id, machine])),
    [machines]
  );

  const pdfAttachmentByInspectionId = useMemo(() => {
    const map = new Map<string, InspectionAttachmentRecord>();

    attachments.forEach((attachment) => {
      if (attachment.kind === "pdf" && !map.has(attachment.inspectionId)) {
        map.set(attachment.inspectionId, attachment);
      }
    });

    return map;
  }, [attachments]);

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
        const customer = customerById.get(inspection.customerId);
        const machine = machineById.get(inspection.machineId);

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
          machine?.machineNumber,
          machine?.brand,
          machine?.model
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [
    customerById,
    customerFilter,
    dateFilter,
    inspections,
    machineById,
    machineFilter,
    query
  ]);

  const groupedInspections = useMemo(
    () => groupInspectionsByYearAndMonth(filteredInspections),
    [filteredInspections]
  );

  const hasActiveFilters = Boolean(
    query.trim() || customerFilter || machineFilter || dateFilter
  );

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

  function renderInspectionRow(inspection: InspectionRecord) {
    const customer = customerById.get(inspection.customerId);
    const machine = machineById.get(inspection.machineId);
    const machineLabel = [
      machine?.internalNumber || machine?.machineNumber,
      machine?.brand,
      machine?.model
    ]
      .filter(Boolean)
      .join(" ");
    const pdfAttachment = pdfAttachmentByInspectionId.get(inspection.id);
    const statusClass =
      inspection.status === "rejected"
        ? "red"
        : inspection.status === "draft"
          ? "orange"
          : "green";

    return (
      <div className="dataset-row compact-overview-row" key={inspection.id}>
        <strong>
          <span className={`status-dot ${statusClass}`} aria-hidden="true" />
          {inspection.inspectionNumber}
        </strong>
        <span className="compact-overview-detail">
          {inspection.inspectionDate} | {customer?.companyName ?? "-"} | {machineLabel || "-"}
        </span>
        <span className="compact-overview-actions">
          {pdfAttachment ? (
            <a
              className="button-secondary"
              href={fileUrl(pdfAttachment.storagePath)}
              target="_blank"
              rel="noreferrer"
            >
              Rapport
            </a>
          ) : null}
          <Link
            className="button-secondary"
            href={
              inspection.status === "draft"
                ? `/keuringen/nieuw?inspectionId=${inspection.id}`
                : `/keuringen/${inspection.id}`
            }
          >
            Openen
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
            Mail
          </button>
        </span>
      </div>
    );
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

      {groupedInspections.length === 0 ? (
        <div className="dataset-list">
          <div className="dataset-row compact-overview-row">
            <strong>Geen keuringen gevonden</strong>
            <span className="compact-overview-detail">
              Pas de filters aan of maak een nieuwe keuring aan.
            </span>
            <span />
          </div>
        </div>
      ) : (
        <div className="archive-stack">
          {groupedInspections.map((yearGroup, yearIndex) => (
            <details
              className="archive-folder archive-year-folder"
              key={yearGroup.year}
              open={hasActiveFilters || yearIndex === 0}
            >
              <summary className="archive-summary">
                <span className="archive-summary-main">
                  <strong>{yearGroup.year}</strong>
                  <span className="archive-summary-meta">
                    {yearGroup.months.reduce((count, month) => count + month.inspections.length, 0)}{" "}
                    keuringen
                  </span>
                </span>
                <span className="archive-summary-meta">
                  {yearGroup.months.length} maanden
                </span>
              </summary>
              <div className="archive-folder-content">
                {yearGroup.months.map((monthGroup, monthIndex) => (
                  <details
                    className="archive-folder archive-month-folder"
                    key={monthGroup.monthKey}
                    open={hasActiveFilters || (yearIndex === 0 && monthIndex === 0)}
                  >
                    <summary className="archive-summary">
                      <span className="archive-summary-main">
                        <strong>{monthGroup.monthLabel}</strong>
                        <span className="archive-summary-meta">
                          {monthGroup.inspections.length} keuringen
                        </span>
                      </span>
                      <span className="archive-summary-meta">
                        Laatste keurnummer {monthGroup.inspections[0]?.inspectionNumber ?? "-"}
                      </span>
                    </summary>
                    <div className="archive-folder-content">
                      <div className="dataset-list">
                        {monthGroup.inspections.map((inspection) =>
                          renderInspectionRow(inspection)
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
