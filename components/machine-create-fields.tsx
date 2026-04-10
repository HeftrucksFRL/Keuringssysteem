"use client";

import { useState } from "react";
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
      {machineType === "batterij_lader" ? (
        <MachinePicker
          machines={machines}
          defaultMachineId={defaultLinkedMachineId}
          label="Gekoppelde machine (optioneel)"
          placeholder="Zoek op intern nummer of serienummer van de machine"
        />
      ) : null}
      <MachineTypeFields machineType={machineType} />
    </>
  );
}
