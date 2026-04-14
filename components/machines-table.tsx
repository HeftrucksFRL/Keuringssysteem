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

type MachineFolderKey = "customer" | "stock" | "service" | "archived";

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

function machineDisplayTitle(machine: MachineRecord) {
  if (machine.machineType === "batterij_lader") {
    const batteryBrand = machine.configuration.battery_brand || machine.brand;
    const batteryType = machine.configuration.battery_type || machine.model;
    const chargerBrand = machine.configuration.charger_brand || "";
    const chargerType = machine.configuration.charger_type || "";

    return (
      [batteryBrand, batteryType].filter(Boolean).join(" ") ||
      [chargerBrand, chargerType].filter(Boolean).join(" ") ||
      "Batterij / lader"
    );
  }

  return [machine.brand, machine.model].filter(Boolean).join(" ") || "Machine";
}

function machineDisplayInternal(machine: MachineRecord) {
  if (machine.machineType === "batterij_lader") {
    return (
      machine.configuration.battery_internal_number ||
      machine.configuration.charger_internal_number ||
      machine.internalNumber ||
      machine.machineNumber
    );
  }

  return machine.internalNumber || machine.machineNumber;
}

function machineDisplaySerial(machine: MachineRecord) {
  if (machine.machineType === "batterij_lader") {
    return (
      machine.configuration.battery_serial_number ||
      machine.configuration.charger_serial_number ||
      machine.serialNumber
    );
  }

  return machine.serialNumber;
}

function machineFolderKey(machine: MachineRecord, owner: CustomerRecord | null): MachineFolderKey {
  if (isArchived(machine)) {
    return "archived";
  }

  if (machine.availabilityStatus === "maintenance") {
    return "service";
  }

  return isStockCustomer(owner) ? "stock" : "customer";
}

const machineFolderOrder: Array<{
  key: MachineFolderKey;
  label: string;
  emptyLabel: string;
  defaultOpen: boolean;
}> = [
  {
    key: "customer",
    label: "Bij klanten",
    emptyLabel: "Geen machines bij klanten gevonden.",
    defaultOpen: true
  },
  {
    key: "stock",
    label: "Voorraad",
    emptyLabel: "Geen voorraadmachines gevonden.",
    defaultOpen: true
  },
  {
    key: "service",
    label: "Onderhoud / service",
    emptyLabel: "Geen machines in onderhoud of service.",
    defaultOpen: false
  },
  {
    key: "archived",
    label: "Archief",
    emptyLabel: "Geen gearchiveerde machines gevonden.",
    defaultOpen: false
  }
];

export function MachinesTable({
  machines,
  customers,
  rentals
}: MachinesTableProps) {
  const [query, setQuery] = useState("");

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

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
      const owner = customerById.get(machine.customerId) ?? null;
      const activeRental = activeRentalsByMachine.get(machine.id);
      const rentalCustomer = activeRental
        ? customerById.get(activeRental.customerId) ?? null
        : null;
      const stockMachine = isStockCustomer(owner);
      const stockSearchTerms = stockMachine
        ? ["voorraad", "eigen voorraad", "heftrucks.frl", "heftrucks friesland"]
        : [];

      return [
        machine.machineNumber,
        machine.internalNumber,
        machine.configuration.battery_internal_number,
        machine.configuration.charger_internal_number,
        machine.brand,
        machine.model,
        machine.serialNumber,
        machine.configuration.battery_brand,
        machine.configuration.battery_type,
        machine.configuration.battery_serial_number,
        machine.configuration.charger_brand,
        machine.configuration.charger_type,
        machine.configuration.charger_serial_number,
        owner?.companyName,
        rentalCustomer?.companyName,
        statusLabel(machine.availabilityStatus, stockMachine),
        isArchived(machine) ? "gearchiveerd archief" : "",
        machineFolderOrder.find((group) => group.key === machineFolderKey(machine, owner))?.label,
        ...stockSearchTerms
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [activeRentalsByMachine, customerById, machines, query]);

  const groupedMachines = useMemo(() => {
    const buckets = new Map<MachineFolderKey, MachineRecord[]>(
      machineFolderOrder.map((group) => [group.key, []])
    );

    [...filteredMachines]
      .sort((left, right) => {
        const leftLabel = `${machineDisplayInternal(left) || ""} ${machineDisplayTitle(left)}`;
        const rightLabel = `${machineDisplayInternal(right) || ""} ${machineDisplayTitle(right)}`;
        return leftLabel.localeCompare(rightLabel, "nl");
      })
      .forEach((machine) => {
        const owner = customerById.get(machine.customerId) ?? null;
        buckets.get(machineFolderKey(machine, owner))?.push(machine);
      });

    return machineFolderOrder.map((group) => ({
      ...group,
      rows: buckets.get(group.key) ?? []
    }));
  }, [customerById, filteredMachines]);

  const isSearching = Boolean(query.trim());

  return (
    <>
      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op intern nummer, merk, type, serienummer of voorraad"
        />
      </div>

      <div className="archive-stack">
        {groupedMachines.map((group) => (
          <details
            className="archive-folder archive-folder-machines"
            key={group.key}
            open={isSearching || group.defaultOpen}
          >
            <summary className="archive-summary">
              <span className="archive-summary-main">
                <strong>{group.label}</strong>
                <span className="archive-summary-meta">{group.rows.length} machines</span>
              </span>
            </summary>
            <div className="archive-folder-content">
              {group.rows.length === 0 ? (
                <div className="archive-empty">{group.emptyLabel}</div>
              ) : (
                <div className="dataset-list">
                  {group.rows.map((machine) => {
                    const owner = customerById.get(machine.customerId) ?? null;
                    const activeRental = activeRentalsByMachine.get(machine.id);
                    const rentalCustomer = activeRental
                      ? customerById.get(activeRental.customerId) ?? null
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
                      ? machine.machineType === "batterij_lader"
                        ? "Batterij en/of lader gearchiveerd"
                        : "Machine gearchiveerd"
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
                          {machineDisplayTitle(machine)} - {machineDisplayInternal(machine) || "-"}
                        </strong>
                        <span>Serienr: {machineDisplaySerial(machine) || "-"}</span>
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
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
