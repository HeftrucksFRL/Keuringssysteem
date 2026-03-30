"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, InspectionRecord, MachineRecord } from "@/lib/domain";
import { titleCase } from "@/lib/utils";

interface MachinesTableProps {
  machines: MachineRecord[];
  customers: CustomerRecord[];
  inspections: InspectionRecord[];
}

export function MachinesTable({
  machines,
  customers,
  inspections
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
      <div className="table-like">
        <div className="table-row table-head">
          <span>Nummer</span>
          <span>Klant</span>
          <span>Type</span>
          <span>Laatste keuring</span>
        </div>
        {filteredMachines.map((machine) => (
          <div className="table-row" key={machine.id}>
            <span>
              <Link href={`/machines/${machine.id}`}>
                {machine.internalNumber || machine.machineNumber}
              </Link>
            </span>
            <span>
              {customers.find((customer) => customer.id === machine.customerId)?.companyName ?? "-"}
            </span>
            <span>{titleCase(machine.machineType)}</span>
            <span>
              {inspections.find((inspection) => inspection.machineId === machine.id)
                ?.inspectionDate ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
