"use client";

import { useState } from "react";
import { MachineTypeFields, machineTypeOptions } from "@/components/machine-type-fields";
import type { MachineType } from "@/lib/types";

type MachineCreateFieldsProps = {
  defaultType: MachineType;
};

export function MachineCreateFields({
  defaultType
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
      <MachineTypeFields machineType={machineType} />
    </>
  );
}
