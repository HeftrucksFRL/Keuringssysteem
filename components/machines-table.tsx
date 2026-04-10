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

function archivedAt(machine: MachineRecord) {
  return machine.configuration.__archivedAt ? new Date(machine.configuration.__archivedAt) : null;
}

function isArchived(machine: MachineRecord) {
  return Boolean(archivedAt(machine));
}

function statusBadgeStyle(
  status: MachineRecord["availabilityStatus"],
  isStockMachine: boolean
) {
  if (status === "rented") {
    return { background: "#dff6ec", color: "#0d8d59" };
  }

  if (status === "maintenance") {
    return { background: "#fff0d8", color: "#d97706" };
  }

  if (isStockMachine) {
    return { background: "#e6f0ff", color: "#175cd3" };
  }

  return { background: "#eff3f8", color: "#526273" };
}

function statusLabel(
  status: MachineRecord["availabilityStatus"],
  isStockMachine: boolean
) {
  if (status === "rented") {
    return "In verhuur";
  }

  if (status === "maintenance") {
    return "Onderhoud";
  }

  return isStockMachine ? "Beschikbaar" : "Bij klant";
}

function normalizeRentalOwnerText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isStockCustomer(customer?: CustomerRecord | null) {
  const company = normalizeRentalOwnerText(customer?.companyName);
  const email = normalizeRentalOwnerText(customer?.email);
  return (
    company.includes("heftrucks") ||
    company.includes("friesland") ||
    email.includes("@heftrucks.frl")
  );
}

function stockOwnerLabel() {
  return "Eigen voorraad - Heftrucks.frl";
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

    return machines.filter((machine) => {
      const owner = customers.find((customer) => customer.id === machine.customerId) ?? null;
      const activeRental = activeRentalsByMachine.get(machine.id);
      const rentalCustomer = activeRental
        ? customers.find((customer) => customer.id === activeRental.customerId) ?? null
        : null;
      const stockMachine = isStockCustomer(owner);
      const stockSearchTerms = stockMachine
        ? ["voorraad", "eigen voorraad", "heftrucks.frl", "heftrucks friesland"]
        : [];

      return [
        machine.machineNumber,
        machine.internalNumber,
        machine.brand,
        machine.model,
        machine.serialNumber,
        owner?.companyName,
        rentalCustomer?.companyName,
        statusLabel(machine.availabilityStatus, stockMachine),
        isArchived(machine) ? "gearchiveerd archief" : "",
        ...stockSearchTerms
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [activeRentalsByMachine, customers, machines, query]);

  return (
    <>
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op intern nummer, merk, type, serienummer of voorraad"
        />
      </div>
      <div className="dataset-list">
        {filteredMachines.map((machine) => {
          const owner = customers.find((customer) => customer.id === machine.customerId) ?? null;
          const activeRental = activeRentalsByMachine.get(machine.id);
          const rentalCustomer = activeRental
            ? customers.find((customer) => customer.id === activeRental.customerId) ?? null
            : null;
          const stockMachine = isStockCustomer(owner);
          const archived = isArchived(machine);
          const ownerLabel = owner
            ? stockMachine
              ? stockOwnerLabel()
              : owner.companyName
            : "-";
          const badgeStyle = archived
            ? { background: "#fee4e2", color: "#b42318" }
            : statusBadgeStyle(machine.availabilityStatus, stockMachine);
          const badgeLabel = archived
            ? "Gearchiveerd"
            : statusLabel(machine.availabilityStatus, stockMachine);

          return (
            <Link
              className="dataset-row"
              href={`/machines/${machine.id}`}
              key={machine.id}
              style={
                archived
                  ? {
                      background: "#fef3f2",
                      borderColor: "#fecdca"
                    }
                  : activeRental
                    ? {
                        background: "#ecfdf3",
                        borderColor: "#abefc6"
                      }
                    : undefined
              }
            >
              <strong>
                {[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"} -{" "}
                {machine.internalNumber || machine.machineNumber}
              </strong>
              <span>Serienr: {machine.serialNumber || "-"}</span>
              <span>
                {activeRental
                  ? `Verhuurd aan ${rentalCustomer?.companyName ?? "-"}`
                  : ownerLabel}{" "}
                - {titleCase(machine.machineType)}
              </span>
              <span>
                <span className="badge" style={badgeStyle}>
                  {badgeLabel}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
