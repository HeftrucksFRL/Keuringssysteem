import { getFormDefinition } from "@/lib/form-definitions";
import type { MachineFieldDefinition, MachineType } from "@/lib/types";

export const machineTypeOptions: { value: MachineType; label: string }[] = [
  { value: "heftruck_reachtruck", label: "Heftruck / reachtruck" },
  { value: "batterij_lader", label: "Batterij en laders" },
  { value: "graafmachine", label: "Graafmachine" },
  { value: "hoogwerker", label: "Hoogwerker" },
  { value: "palletwagen_stapelaar", label: "Palletwagen / stapelaar" },
  { value: "shovel", label: "Shovel" },
  { value: "verreiker", label: "Verreiker" },
  { value: "stellingmateriaal", label: "Stellingmateriaal" }
];

type MachineTypeFieldsProps = {
  machineType: MachineType;
  values?: Record<string, string>;
  disabled?: boolean;
  hiddenKeys?: string[];
};

function editableFields(machineType: MachineType) {
  return getFormDefinition(machineType).machineFields.filter(
    (field) =>
      !field.key.startsWith("customer_") &&
      field.key !== "inspection_date" &&
      field.key !== "machine_number"
  );
}

function groupedFieldKeys(machineType: MachineType) {
  if (machineType !== "batterij_lader") {
    return [
      {
        key: "algemeen",
        title: "",
        fields: editableFields(machineType)
      }
    ];
  }

  const fields = editableFields(machineType);
  const lookup = new Map(fields.map((field) => [field.key, field]));
  const pick = (keys: string[]) =>
    keys
      .map((key) => lookup.get(key))
      .filter((field): field is MachineFieldDefinition => Boolean(field));

  return [
    {
      key: "voertuig",
      title: "Voertuig",
      fields: pick([
        "vehicle_brand",
        "vehicle_type",
        "vehicle_build_year",
        "vehicle_internal_number",
        "vehicle_serial_number"
      ])
    },
    {
      key: "batterij",
      title: "Batterij",
      fields: pick([
        "battery_type",
        "battery_brand",
        "battery_serial_number",
        "battery_internal_number",
        "drawing_number"
      ])
    },
    {
      key: "lader",
      title: "Lader",
      fields: pick([
        "charger_type",
        "charger_brand",
        "charger_serial_number",
        "charger_internal_number",
        "charger_voltage",
        "double_insulated"
      ])
    }
  ];
}

export function MachineTypeFields({
  machineType,
  values = {},
  disabled = false,
  hiddenKeys = []
}: MachineTypeFieldsProps) {
  const hiddenKeySet = new Set(hiddenKeys);
  const groups = groupedFieldKeys(machineType);

  return (
    <>
      {groups.map((group) => {
        const visibleFields = group.fields.filter((field) => !hiddenKeySet.has(field.key));
        if (visibleFields.length === 0) {
          return null;
        }

        return (
          <div key={group.key} style={{ marginTop: group.title ? "1rem" : 0 }}>
            {group.title ? <div className="eyebrow">{group.title}</div> : null}
            <div className="form-grid-wide">
              {visibleFields.map((field) => (
                <div className="field" key={field.key}>
                  <label htmlFor={field.key}>{field.label}</label>
                  <input
                    id={field.key}
                    name={field.key}
                    type={field.type ?? "text"}
                    defaultValue={values[field.key] ?? ""}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
