"use client";

import { useEffect, useMemo, useState } from "react";
import type { MachineRecord } from "@/lib/domain";

interface MachinePickerProps {
  machines: MachineRecord[];
  name?: string;
  label?: string;
  defaultMachineId?: string;
  placeholder?: string;
  required?: boolean;
}

function machineSearchText(machine: MachineRecord) {
  return [
    machine.internalNumber,
    machine.machineNumber,
    machine.brand,
    machine.model,
    machine.serialNumber,
    machine.configuration.vehicle_internal_number,
    machine.configuration.vehicle_serial_number,
    machine.configuration.battery_internal_number,
    machine.configuration.battery_serial_number,
    machine.configuration.charger_internal_number,
    machine.configuration.charger_serial_number
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function machineLabel(machine: MachineRecord) {
  if (machine.machineType === "batterij_lader") {
    const vehicle = [machine.configuration.vehicle_brand || machine.brand, machine.configuration.vehicle_type || machine.model]
      .filter(Boolean)
      .join(" ");
    const internal =
      machine.configuration.vehicle_internal_number ||
      machine.internalNumber ||
      machine.machineNumber ||
      "-";
    return `${vehicle || "Batterij / lader"} - ${internal}`;
  }

  return `${[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"} - ${
    machine.internalNumber || machine.machineNumber || "-"
  }`;
}

function machineHint(machine: MachineRecord) {
  if (machine.machineType === "batterij_lader") {
    return (
      machine.configuration.vehicle_serial_number ||
      machine.configuration.battery_serial_number ||
      machine.configuration.charger_serial_number ||
      machine.serialNumber ||
      "-"
    );
  }

  return machine.serialNumber || "-";
}

export function MachinePicker({
  machines,
  name = "linked_machine_id",
  label = "Machine",
  defaultMachineId = "",
  placeholder = "Zoek op intern nummer of serienummer",
  required = false
}: MachinePickerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultMachineId);
  const [open, setOpen] = useState(false);

  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedId) ?? null,
    [machines, selectedId]
  );

  useEffect(() => {
    if (selectedMachine) {
      setQuery(machineLabel(selectedMachine));
    } else if (!defaultMachineId) {
      setQuery("");
    }
  }, [defaultMachineId, selectedMachine]);

  const filteredMachines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return machines.slice(0, 8);
    }

    return machines
      .filter((machine) => machineSearchText(machine).includes(needle))
      .slice(0, 8);
  }, [machines, query]);

  return (
    <div className="field autocomplete">
      <label htmlFor={`${name}-picker`}>{label}</label>
      <input
        id={`${name}-picker`}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setOpen(true);
        }}
      />
      <input type="hidden" name={name} value={selectedId} required={required} />
      {open && filteredMachines.length > 0 ? (
        <div className="autocomplete-menu">
          {filteredMachines.map((machine) => (
            <button
              className="autocomplete-item"
              key={machine.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSelectedId(machine.id);
                setQuery(machineLabel(machine));
                setOpen(false);
              }}
            >
              <strong>{machineLabel(machine)}</strong>
              <span>{machineHint(machine)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selectedMachine ? (
        <div className="selected-summary">
          <strong>Gekoppeld</strong>
          <span>{machineLabel(selectedMachine)}</span>
        </div>
      ) : null}
    </div>
  );
}
