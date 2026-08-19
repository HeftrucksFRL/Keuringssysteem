import assert from "node:assert/strict";
import test from "node:test";
import { buildInspectionRemarks } from "../lib/documents";
import type { InspectionRecord } from "../lib/domain";

function inspection(overrides: Partial<InspectionRecord>): InspectionRecord {
  return {
    id: "inspection-1",
    inspectionNumber: "260001",
    customerId: "customer-1",
    machineId: "machine-1",
    machineType: "verreiker",
    inspectionDate: "2026-08-14",
    nextInspectionDate: "2027-08-14",
    status: "approved",
    sendPdfToCustomer: false,
    customerSnapshot: {},
    machineSnapshot: {},
    checklist: {},
    checklistNotes: {},
    findings: "",
    recommendations: "",
    conclusion: "",
    resultLabels: [],
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    ...overrides
  };
}

test("keurpunttoelichtingen komen voor de vrije opmerkingen in het rapport", () => {
  const remarks = buildInspectionRemarks(
    inspection({
      checklist: {
        documenten: "aandacht",
        veiligheids_bedieningsstickers: "afkeur",
        veiligheidsgordel: "goed"
      },
      checklistNotes: {
        documenten: "Handleiding ontbreekt.",
        veiligheids_bedieningsstickers: "Waarschuwingssticker onleesbaar.",
        veiligheidsgordel: "Deze toelichting hoort niet in het rapport."
      },
      findings: "Vrije opmerking blijft bewerkbaar."
    })
  );

  assert.match(remarks, /^1\. Documentatie & identificatie - Documenten \(Aandacht\):/);
  assert.match(remarks, /1\. Documentatie & identificatie - Veiligheids- & bedieningsstickers \(Afkeur\):/);
  assert.match(remarks, /Vrije opmerking blijft bewerkbaar\.$/);
  assert.doesNotMatch(remarks, /hoort niet in het rapport/);
});
