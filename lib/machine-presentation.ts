import type { MachineRecord } from "@/lib/domain";

type MachineLike = Partial<
  Pick<MachineRecord, "machineType" | "brand" | "model" | "serialNumber" | "configuration">
> & {
  machine_type?: string;
  serial_number?: string;
  location?: string;
};

function machineTypeValue(machine: MachineLike) {
  return String(machine.machineType ?? machine.machine_type ?? "").trim();
}

function machineConfiguration(machine: MachineLike) {
  return machine.configuration ?? {};
}

function readValue(machine: MachineLike, camelKey: keyof MachineRecord | string, snakeKey?: string) {
  const candidate =
    camelKey in machine
      ? String((machine as Record<string, unknown>)[camelKey] ?? "")
      : "";

  if (candidate.trim()) {
    return candidate.trim();
  }

  if (snakeKey && snakeKey in machine) {
    return String((machine as Record<string, unknown>)[snakeKey] ?? "").trim();
  }

  return "";
}

export function isBatteryChargerMachine(machine: MachineLike) {
  return machineTypeValue(machine) === "batterij_lader";
}

export function isRackingMachine(machine: MachineLike) {
  return machineTypeValue(machine) === "stellingmateriaal";
}

export function getMachineKindLabel(machine: MachineLike) {
  if (isBatteryChargerMachine(machine)) {
    return "Batterij/lader";
  }

  if (isRackingMachine(machine)) {
    return "Stelling";
  }

  return "Machine";
}

export function getMachineDisplayTitle(machine: MachineLike) {
  const configuration = machineConfiguration(machine);

  if (isBatteryChargerMachine(machine)) {
    return (
      [configuration.battery_brand || readValue(machine, "brand"), configuration.battery_type || readValue(machine, "model")]
        .filter(Boolean)
        .join(" ") ||
      [configuration.charger_brand, configuration.charger_type].filter(Boolean).join(" ") ||
      [readValue(machine, "brand"), readValue(machine, "model")].filter(Boolean).join(" ") ||
      "Batterij / lader"
    );
  }

  if (isRackingMachine(machine)) {
    return (
      [readValue(machine, "brand"), readValue(machine, "model") || configuration.racking_type]
        .filter(Boolean)
        .join(" ") ||
      configuration.racking_type ||
      "Stelling"
    );
  }

  return [readValue(machine, "brand"), readValue(machine, "model")].filter(Boolean).join(" ") || "Machine";
}

export function getMachineDisplaySerial(machine: MachineLike) {
  const configuration = machineConfiguration(machine);

  if (isBatteryChargerMachine(machine)) {
    return (
      configuration.battery_serial_number ||
      configuration.charger_serial_number ||
      readValue(machine, "serialNumber", "serial_number")
    );
  }

  return readValue(machine, "serialNumber", "serial_number");
}

export function formatMachineBrandTypeSerial(
  machine: MachineLike,
  options: { includeSerial?: boolean } = {}
) {
  const includeSerial = options.includeSerial ?? true;
  const title = getMachineDisplayTitle(machine);
  const serial = includeSerial ? getMachineDisplaySerial(machine) : "";

  return [title, serial].filter(Boolean).join(" ") || title || "-";
}

export function formatMachineKindBrandType(machine: MachineLike) {
  const title = getMachineDisplayTitle(machine);

  if (isBatteryChargerMachine(machine) || isRackingMachine(machine)) {
    return `${getMachineKindLabel(machine)}: ${title}`;
  }

  return title;
}

export function getMachineLocation(machine: MachineLike) {
  const configuration = machineConfiguration(machine);
  return configuration.location || readValue(machine, "location") || "";
}
