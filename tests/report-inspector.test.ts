import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { generateInspectionDocuments } from "../lib/documents";
import type { InspectionRecord } from "../lib/domain";
import {
  canonicalInspectionActor,
  inspectionInspectorName,
  inspectionTemplateOwner
} from "../lib/inspection-inspector";

function inspection(overrides: Partial<InspectionRecord> = {}): InspectionRecord {
  return {
    id: "inspection-renze",
    inspectionNumber: "269999",
    customerId: "customer-1",
    machineId: "machine-1",
    machineType: "heftruck",
    inspectionDate: "2026-08-19",
    nextInspectionDate: "2027-08-19",
    status: "approved",
    sendPdfToCustomer: false,
    customerSnapshot: { customer_name: "Testklant" },
    machineSnapshot: { brand: "Toyota", model: "Testmodel" },
    checklist: {},
    checklistNotes: {},
    findings: "",
    recommendations: "",
    conclusion: "",
    resultLabels: [],
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides
  };
}

function wordXmlText(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  return zip
    .getEntries()
    .filter((entry) => /^word\/(document|footer\d+)\.xml$/.test(entry.entryName))
    .map((entry) => zip.readAsText(entry))
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

test("bekende accounts krijgen de volledige naam van de keurmeester", () => {
  assert.equal(
    canonicalInspectionActor({
      id: "renze-id",
      email: "INFO@HEFTRUCKS.FRL",
      name: "Renze"
    }).name,
    "Renze Pieter Veltman"
  );
  assert.equal(
    canonicalInspectionActor({
      id: "age-id",
      email: "info@terpstratrading.frl",
      name: "Info"
    }).name,
    "Age Terpstra"
  );
});

test("oude keuringen zonder keurmeester blijven het Age-sjabloon gebruiken", () => {
  const legacyInspection = inspection({ inspectorName: undefined, inspectorEmail: undefined });
  assert.equal(inspectionTemplateOwner(legacyInspection), "Age");
  assert.equal(inspectionInspectorName(legacyInspection), "Age Terpstra");
});

test("een Renze-keuring gebruikt de Renze-naam in inhoud en voetregel van Word", async () => {
  const renzeInspection = inspection({
    inspectorId: "renze-id",
    inspectorName: "Renze Pieter Veltman",
    inspectorEmail: "info@heftrucks.frl"
  });

  assert.equal(inspectionTemplateOwner(renzeInspection), "Renze");
  const documents = await generateInspectionDocuments(renzeInspection, {
    persistToDisk: false
  });
  const text = wordXmlText(documents.wordBuffer);

  assert.match(text, /Keurmeester Renze Pieter Veltman/);
  assert.doesNotMatch(text, /Keurmeester Age Terpstra/);
});

test("een Age-keuring gebruikt de Age-naam in inhoud en voetregel van Word", async () => {
  const ageInspection = inspection({
    id: "inspection-age",
    inspectorId: "age-id",
    inspectorName: "Age Terpstra",
    inspectorEmail: "info@terpstratrading.frl"
  });

  assert.equal(inspectionTemplateOwner(ageInspection), "Age");
  const documents = await generateInspectionDocuments(ageInspection, {
    persistToDisk: false
  });
  const text = wordXmlText(documents.wordBuffer);

  assert.match(text, /Keurmeester Age Terpstra/);
  assert.doesNotMatch(text, /Keurmeester Renze Pieter Veltman/);
});
