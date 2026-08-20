import assert from "node:assert/strict";
import test from "node:test";
import { isRentalStockCustomer } from "../lib/stock-customer";

test("een gewone klant wordt nooit voorraad door het contact-e-mailadres", () => {
  assert.equal(
    isRentalStockCustomer({
      companyName: "Heftruck opleiding BV",
      email: "info@terpstratrading.frl"
    }),
    false
  );
  assert.equal(
    isRentalStockCustomer({
      companyName: "Voorbeeldklant",
      email: "planning@heftrucks.frl"
    }),
    false
  );
});

test("de eigen voorraad blijft herkenbaar aan de bedrijfsnaam", () => {
  assert.equal(isRentalStockCustomer({ companyName: "Heftrucks.frl", email: "" }), true);
  assert.equal(isRentalStockCustomer({ companyName: "Terpstra Trading B.V.", email: "" }), true);
});
