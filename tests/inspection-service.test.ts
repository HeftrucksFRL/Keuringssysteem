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

import {getInspectionCustomerDates,getInspectionSummaries} from "../lib/inspection-service";
test("light customer history retains every customer/date pair without machine snapshots",async()=>{
 const previous=process.env.LOCAL_TEST_MODE;process.env.LOCAL_TEST_MODE="1";
 try{
  const [dates,inspections]=await Promise.all([getInspectionCustomerDates(),getInspectionSummaries()]);
  assert.deepEqual(dates,inspections.map(({customerId,inspectionDate})=>({customerId,inspectionDate})));
  assert.ok(dates.every(row=>Object.keys(row).length===2));
 }finally{if(previous===undefined)delete process.env.LOCAL_TEST_MODE;else process.env.LOCAL_TEST_MODE=previous;}
});
