"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, MachineRecord, RentalRecord } from "@/lib/domain";
import { titleCase } from "@/lib/utils";

interface MachinesTableProps {
  machines: MachineRecord[];
  customers: CustomerRecord[];
  rentals: RentalRecord[];
}

function statusBadgeStyle(status: MachineRecord["availabilityStatus"]) {
  if (status === "rented") {
    return { background: "#dff6ec", color: "#0d8d59" };
  }

  if (status === "maintenance") {
    return { background: "#fff0d8", color: "#d97706" };
  }

  return { background: "#e6f0ff", color: "#175cd3" };
}

function statusLabel(status: MachineRecord["availabilityStatus"]) {
  if (status === "rented") {
    return "In verhuur";
  }

  if (status === "maintenance") {
    return "Onderhoud";
  }

  return "Beschikbaar";
}

export function MachinesTable({
  machines,
  customers,
  rentals
}: MachinesTableProps) {
  const [query, setQuery] = useState("");

  const activeRentalsByMachine = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Map(
      rentals
        .filter(
          (rental) =>
            rental.status === "active" &&
            rental.startDate <= today &&
            rental.endDate >= today
        )
        .map((rental) => [rental.machineId, rental] as const)
    );
  }, [rentals]);

  const filteredMachines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return machines;
    }

    return machines.filter((machine) =>
      [
        machine.machineNumber,
        machine.internalNumber,
        machine.brand,
        machine.model,
        machine.serialNumber
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [machines, query]);

  return (
    <>
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op intern nummer, merk, type of serienummer"
        />
      </div>
      <div className="dataset-list">
        {filteredMachines.map((machine) => {
          const owner = customers.find((customer) => customer.id === machine.customerId) ?? null;
          const activeRental = activeRentalsByMachine.get(machine.id);
          const rentalCustomer = activeRental
            ? customers.find((customer) => customer.id === activeRental.customerId) ?? null
            : null;

        return (
            <Link
              className="dataset-row"
              href={`/machines/${machine.id}`}
              key={machine.id}
              style={
                activeRental
                  ? {
                      background: "#ecfdf3",
                      borderColor: "#abefc6"
                    }
                  : undefined
              }
            >
              <strong>
                {[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"} ·{" "}
                {machine.internalNumber || machine.machineNumber}
              </strong>
              <span>Serienr: {machine.serialNumber || "-"}</span>
              <span>
                {activeRental
                  ? `Verhuurd aan ${rentalCustomer?.companyName ?? "-"}`
                  : owner?.companyName ?? "-"}{" "}
                · {titleCase(machine.machineType)}
              </span>
              <span>
                <span className="badge" style={statusBadgeStyle(machine.availabilityStatus)}>
                  {statusLabel(machine.availabilityStatus)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
