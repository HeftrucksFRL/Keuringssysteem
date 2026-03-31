"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, MachineRecord } from "@/lib/domain";
import { titleCase } from "@/lib/utils";

interface MachinesTableProps {
  machines: MachineRecord[];
  customers: CustomerRecord[];
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
          <Link
            className="dataset-row"
            href={`/machines/${machine.id}`}
            key={machine.id}
          >
            <strong>
              {[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"} ·{" "}
              {machine.internalNumber || machine.machineNumber}
            </strong>
            <span>Serienr: {machine.serialNumber || "-"}</span>
            <span>
              {customers.find((customer) => customer.id === machine.customerId)?.companyName ?? "-"} ·{" "}
              {titleCase(machine.machineType)}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
