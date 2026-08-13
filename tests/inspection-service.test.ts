import assert from "node:assert/strict";
import test from "node:test";
import { batteryChargerInspectionConfiguration } from "@/lib/inspection-service";

test("een batterij-/laderkeuring behoudt de bestaande machinekoppeling", () => {
  const configuration = batteryChargerInspectionConfiguration(
    {
      machineType: "batterij_lader",
      configuration: {
        linked_machine_id: "  heftruck-123  ",
        battery_brand: "Oud merk",
        charger_type: "Oud type"
      }
    },
    {
      battery_brand: "Nieuw merk",
      charger_type: "Nieuw type",
      machine_number: "mag-niet-in-configuratie"
    }
  );

  assert.deepEqual(configuration, {
    battery_brand: "Nieuw merk",
    charger_type: "Nieuw type",
    linked_machine_id: "heftruck-123"
  });
});

test("een ontbrekende koppeling wordt niet toegevoegd", () => {
  const configuration = batteryChargerInspectionConfiguration(
    {
      machineType: "batterij_lader",
      configuration: { battery_brand: "Bestaand merk" }
    },
    { battery_brand: "Nieuw merk" }
  );

  assert.deepEqual(configuration, { battery_brand: "Nieuw merk" });
});

test("een koppeling van een ander machinetype wordt niet overgenomen", () => {
  const configuration = batteryChargerInspectionConfiguration(
    {
      machineType: "heftruck_reachtruck",
      configuration: { linked_machine_id: "onverwachte-koppeling" }
    },
    { location: "Leeuwarden" }
  );

  assert.deepEqual(configuration, { location: "Leeuwarden" });
});
