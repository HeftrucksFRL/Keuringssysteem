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
          placeholder="Zoek op klantnaam, contact of e-mail"
        />
      </div>
      <div className="table-like">
        <div className="table-row table-head">
          <span>Naam</span>
          <span>Contact</span>
          <span>Machines</span>
          <span>Laatste keuring</span>
        </div>
        {filteredCustomers.map((customer) => (
          <div className="table-row" key={customer.id}>
            <span>
              <Link href={`/klanten/${customer.id}`}>{customer.companyName}</Link>
            </span>
            <span>{customer.contactName || customer.email || "-"}</span>
            <span>{machines.filter((machine) => machine.customerId === customer.id).length}</span>
            <span>
              {inspections.find((inspection) => inspection.customerId === customer.id)
                ?.inspectionDate ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
