import assert from "node:assert/strict";
import test from "node:test";
import { canCorrectInspectionCustomer } from "@/lib/auth";
import { isCustomerArchived } from "@/lib/inspection-service";

test("alleen info@heftruckopleiding.frl mag een rapportklant corrigeren", () => {
  assert.equal(canCorrectInspectionCustomer({ email: "info@heftruckopleiding.frl" }), true);
  assert.equal(canCorrectInspectionCustomer({ email: "INFO@HEFTRUCKOPLEIDING.FRL" }), true);
  assert.equal(canCorrectInspectionCustomer({ email: "info@terpstratrading.frl" }), false);
  assert.equal(canCorrectInspectionCustomer(null), false);
});

test("een klant is alleen gearchiveerd met een archiefdatum", () => {
  assert.equal(isCustomerArchived({}), false);
  assert.equal(isCustomerArchived({ archivedAt: "" }), false);
  assert.equal(isCustomerArchived({ archivedAt: "2026-08-13T12:00:00.000Z" }), true);
});
