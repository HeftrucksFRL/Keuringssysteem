"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, InspectionRecord, MachineRecord } from "@/lib/domain";

interface CustomersTableProps {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
}

export function CustomersTable({
  customers,
  machines,
  inspections
}: CustomersTableProps) {
  const [query, setQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.companyName, customer.contactName, customer.email, customer.phone]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [customers, query]);

  return (
    <>
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op klantnaam, contact of algemeen e-mailadres"
        />
      </div>
      <div className="dataset-list">
        {filteredCustomers.map((customer) => (
          <Link className="dataset-row" href={`/klanten/${customer.id}`} key={customer.id}>
            <strong>{customer.companyName}</strong>
            <span>{customer.contactName || customer.email || "-"}</span>
            <span>
              {machines.filter((machine) => machine.customerId === customer.id).length} machines · Laatste keuring{" "}
              {inspections.find((inspection) => inspection.customerId === customer.id)?.inspectionDate ?? "-"}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
