"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, MachineRecord, RentalRecord } from "@/lib/domain";
import { todayLocalIso } from "@/lib/utils";

interface RentalStockListProps {
  stockMachines: MachineRecord[];
  customers: CustomerRecord[];
  rentals: RentalRecord[];
  stockOwnerLabel: string;
}

function rentalPhase(rental: RentalRecord) {
  const today = todayLocalIso();
  if (rental.status === "completed" || rental.endDate < today) {
    return "completed" as const;
  }
  if (rental.startDate > today) {
    return "upcoming" as const;
  }
  return "active" as const;
}

export function RentalStockList({
  stockMachines,
  customers,
  rentals,
  stockOwnerLabel
}: RentalStockListProps) {
  const [query, setQuery] = useState("");

  const rentalByMachine = useMemo(() => {
    const map = new Map<string, RentalRecord>();
    rentals.forEach((rental) => {
      const phase = rentalPhase(rental);
      if (phase === "active" || phase === "upcoming") {
        map.set(rental.machineId, rental);
      }
    });
    return map;
  }, [rentals]);

  const filteredMachines = useMemo(() => {
    if (query === "") {
      return [];
    }

    const needle = query.trim().toLowerCase();
    if (!needle) {
      return stockMachines;
    }

    return stockMachines.filter((machine) => {
      const rental = rentalByMachine.get(machine.id);
      const rentalCustomer = rental
        ? customers.find((customer) => customer.id === rental.customerId)
        : null;

      return [
        "voorraad",
        "eigen voorraad",
        "heftrucks.frl",
        machine.internalNumber,
        machine.machineNumber,
        machine.brand,
        machine.model,
        machine.serialNumber,
        rentalCustomer?.companyName,
        machine.availabilityStatus === "rented" ? "in verhuur" : "beschikbaar"
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [customers, query, rentalByMachine, stockMachines]);

  return (
    <div className="compact-stock-panel">
      <div className="search-bar compact-search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek voorraadmachine of typ spatie voor alles"
        />
      </div>

      {query === "" ? (
        <div className="dataset-row compact-stock-empty">
          <strong>Voorraad staat klaar</strong>
          <span>Typ om te zoeken. Een spatie laat direct alle voorraadmachines zien.</span>
        </div>
      ) : (
        <div className="dataset-list compact-stock-list">
          {filteredMachines.length === 0 ? (
            <div className="dataset-row compact-stock-empty">
              <strong>Geen voorraadmachines gevonden</strong>
              <span>Probeer een intern nummer, merk, type of het woord voorraad.</span>
            </div>
          ) : (
            filteredMachines.map((machine) => {
              const rental = rentalByMachine.get(machine.id);
              const rentalCustomer = rental
                ? customers.find((customer) => customer.id === rental.customerId) ?? null
                : null;

              return (
                <Link
                  className={`compact-stock-item ${machine.availabilityStatus === "rented" ? "is-rented" : "is-stock"}`}
                  href={`/machines/${machine.id}`}
                  key={machine.id}
                >
                  <strong>
                    {machine.internalNumber || machine.machineNumber} · {[machine.brand, machine.model]
                      .filter(Boolean)
                      .join(" ")}
                  </strong>
                  <span>{stockOwnerLabel}</span>
                  <span>
                    {rentalCustomer ? `Verhuurd aan ${rentalCustomer.companyName}` : "Op voorraad"}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
