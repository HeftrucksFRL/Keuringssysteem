"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomerRecord } from "@/lib/domain";

interface CustomerPickerProps {
  customers: CustomerRecord[];
  name?: string;
  label?: string;
  defaultCustomerId?: string;
  required?: boolean;
}

export function CustomerPicker({
  customers,
  name = "customerId",
  label = "Klant",
  defaultCustomerId = "",
  required = false
}: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultCustomerId);
  const [open, setOpen] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? null,
    [customers, selectedId]
  );

  useEffect(() => {
    if (selectedCustomer) {
      setQuery(selectedCustomer.companyName);
    }
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) =>
        [customer.companyName, customer.contactName, customer.address, customer.city]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 8);
  }, [customers, query]);

  return (
    <div className="field autocomplete">
      <label htmlFor={`${name}-picker`}>{label}</label>
      <input
        id={`${name}-picker`}
        autoComplete="off"
        placeholder="Zoek een klant"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setOpen(true);
        }}
      />
      <input type="hidden" name={name} value={selectedId} required={required} />
      {open && filteredCustomers.length > 0 ? (
        <div className="autocomplete-menu">
          {filteredCustomers.map((customer) => (
            <button
              className="autocomplete-item"
              key={customer.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSelectedId(customer.id);
                setQuery(customer.companyName);
                setOpen(false);
              }}
            >
              <strong>{customer.companyName}</strong>
              <span>{customer.contactName || customer.city || customer.address || "-"}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selectedCustomer ? (
        <div className="selected-summary">
          <strong>Gekozen klant</strong>
          <span>{selectedCustomer.companyName}</span>
        </div>
      ) : null}
    </div>
  );
}
