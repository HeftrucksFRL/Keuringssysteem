"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, MachineRecord } from "@/lib/domain";
import { titleCase } from "@/lib/utils";

interface MachinesTableProps {
  machines: MachineRecord[];
  customers: CustomerRecord[];
}

function statusBadgeStyle(status: MachineRecord["availabilityStatus"]) {
  if (status === "rented") {
    return { background: "#fde8e6", color: "#b42318" };
  }

  if (status === "maintenance") {
    return { background: "#fff0d8", color: "#d97706" };
  }

  return { background: "#dff6ec", color: "#0d8d59" };
}

function statusLabel(status: MachineRecord["availabilityStatus"]) {
  if (status === "rented") {
    return "Verhuurd";
  }

  if (status === "maintenance") {
    return "Onderhoud";
  }

  return "Beschikbaar";
}

export function MachinesTable({
  machines,
  customers
}: MachinesTableProps) {
  const [query, setQuery] = useState("");

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
        {filteredMachines.map((machine) => (
          <Link className="dataset-row" href={`/machines/${machine.id}`} key={machine.id}>
            <strong>
              {[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"} ·{" "}
              {machine.internalNumber || machine.machineNumber}
            </strong>
            <span>Serienr: {machine.serialNumber || "-"}</span>
            <span>
              {customers.find((customer) => customer.id === machine.customerId)?.companyName ?? "-"} ·{" "}
              {titleCase(machine.machineType)}
            </span>
            <span>
              <span className="badge" style={statusBadgeStyle(machine.availabilityStatus)}>
                {statusLabel(machine.availabilityStatus)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
