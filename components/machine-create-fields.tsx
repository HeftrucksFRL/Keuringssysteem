"use client";

import { useMemo, useState } from "react";
import { MachinePicker } from "@/components/machine-picker";
import { MachineTypeFields, machineTypeOptions } from "@/components/machine-type-fields";
import type { MachineRecord } from "@/lib/domain";
import type { MachineType } from "@/lib/types";

type MachineCreateFieldsProps = {
  defaultType: MachineType;
  machines: MachineRecord[];
  defaultLinkedMachineId?: string;
};

export function MachineCreateFields({
  defaultType,
  machines,
  defaultLinkedMachineId = ""
}: MachineCreateFieldsProps) {
  const [machineType, setMachineType] = useState<MachineType>(defaultType);
  const [selectedLinkedMachineId, setSelectedLinkedMachineId] = useState(defaultLinkedMachineId);
  const [skipLink, setSkipLink] = useState(!defaultLinkedMachineId);

  const selectedLinkedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedLinkedMachineId) ?? null,
    [machines, selectedLinkedMachineId]
  );

  const hiddenVehicleFields =
    machineType === "batterij_lader"
      ? [
          "vehicle_brand",
          "vehicle_type",
          "vehicle_build_year",
          "vehicle_internal_number",
          "vehicle_serial_number"
        ]
      : [];

  return (
    <>
      <div className="field">
        <label htmlFor="machineType">Soort</label>
        <select
          id="machineType"
          name="machineType"
          value={machineType}
          onChange={(event) => setMachineType(event.target.value as MachineType)}
        >
          {machineTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <MachineTypeFields machineType={machineType} hiddenKeys={hiddenVehicleFields} />
      {machineType === "batterij_lader" ? (
        <div style={{ marginTop: "1rem" }}>
          <div className="eyebrow">Koppelen aan machine</div>
          <label className="status-chip" htmlFor="skip-machine-link" style={{ marginBottom: "0.75rem" }}>
            <input
              id="skip-machine-link"
              type="checkbox"
              checked={skipLink}
              onChange={(event) => {
                const checked = event.target.checked;
                setSkipLink(checked);
                if (checked) {
                  setSelectedLinkedMachineId("");
                }
              }}
            />
            Niet koppelen aan machine
          </label>
          {!skipLink ? (
            <>
              <MachinePicker
                machines={machines}
                defaultMachineId={defaultLinkedMachineId}
                label="Gekoppelde machine"
                placeholder="Zoek op intern nummer of serienummer van de machine"
                onSelectedMachineChange={(machine) => {
                  setSelectedLinkedMachineId(machine?.id ?? "");
                }}
              />
              {selectedLinkedMachine ? (
                <div className="selected-summary">
                  <strong>Machine gevonden</strong>
                  <span>
                    {[selectedLinkedMachine.brand, selectedLinkedMachine.model].filter(Boolean).join(" ") || "Machine"} -{" "}
                    {selectedLinkedMachine.internalNumber || selectedLinkedMachine.machineNumber || "-"}
                  </span>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: "0.75rem" }}>
                  Kies een machine om de voertuiggegevens automatisch te laten volgen.
                </p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
