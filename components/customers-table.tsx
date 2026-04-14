"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, InspectionRecord, MachineRecord } from "@/lib/domain";

interface CustomersTableProps {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
}

interface CustomerLetterGroup {
  letter: string;
  customers: CustomerRecord[];
}

function firstLetter(value: string) {
  const character = value.trim().charAt(0).toLocaleUpperCase("nl-NL");

  if (!character) {
    return "#";
  }

  return /[A-Z0-9]/.test(character) ? character : "#";
}

export function CustomersTable({
  customers,
  machines,
  inspections
}: CustomersTableProps) {
  const [query, setQuery] = useState("");

  const machineCountByCustomerId = useMemo(() => {
    const counts = new Map<string, number>();

    machines.forEach((machine) => {
      counts.set(machine.customerId, (counts.get(machine.customerId) ?? 0) + 1);
    });

    return counts;
  }, [machines]);

  const lastInspectionByCustomerId = useMemo(() => {
    const map = new Map<string, string>();

    [...inspections]
      .sort((left, right) => right.inspectionDate.localeCompare(left.inspectionDate, "nl"))
      .forEach((inspection) => {
        if (!map.has(inspection.customerId)) {
          map.set(inspection.customerId, inspection.inspectionDate);
        }
      });

    return map;
  }, [inspections]);

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const rows = !needle
      ? customers
      : customers.filter((customer) =>
          [customer.companyName, customer.contactName, customer.email, customer.phone]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        );

    return [...rows].sort((left, right) =>
      left.companyName.localeCompare(right.companyName, "nl")
    );
  }, [customers, query]);

  const groupedCustomers = useMemo(() => {
    const groups = new Map<string, CustomerRecord[]>();

    filteredCustomers.forEach((customer) => {
      const letter = firstLetter(customer.companyName);
      const rows = groups.get(letter) ?? [];
      rows.push(customer);
      groups.set(letter, rows);
    });

    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right, "nl"))
      .map(
        ([letter, groupedRows]): CustomerLetterGroup => ({
          letter,
          customers: groupedRows
        })
      );
  }, [filteredCustomers]);

  const isSearching = Boolean(query.trim());

  return (
    <>
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op klantnaam, contact of algemeen e-mailadres"
        />
      </div>

      {groupedCustomers.length === 0 ? (
        <div className="dataset-list">
          <div className="dataset-row compact-overview-row">
            <strong>Geen klanten gevonden</strong>
            <span className="compact-overview-detail">
              Probeer een andere zoekterm.
            </span>
            <span />
          </div>
        </div>
      ) : (
        <div className="archive-stack">
          {groupedCustomers.map((group, groupIndex) => (
            <details
              className="archive-folder archive-folder-customers"
              key={group.letter}
              open={isSearching || groupIndex < 3}
            >
              <summary className="archive-summary">
                <span className="archive-summary-main">
                  <strong>{group.letter}</strong>
                  <span className="archive-summary-meta">
                    {group.customers.length} klanten
                  </span>
                </span>
              </summary>
              <div className="archive-folder-content">
                <div className="dataset-list">
                  {group.customers.map((customer) => (
                    <Link className="dataset-row" href={`/klanten/${customer.id}`} key={customer.id}>
                      <strong>{customer.companyName}</strong>
                      <span>{customer.contactName || customer.email || "-"}</span>
                      <span>
                        {machineCountByCustomerId.get(customer.id) ?? 0} machines | Laatste keuring{" "}
                        {lastInspectionByCustomerId.get(customer.id) ?? "-"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
