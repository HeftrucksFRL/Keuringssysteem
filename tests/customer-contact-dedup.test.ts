import assert from "node:assert/strict";
import test from "node:test";
import {
  contactIdentityKey,
  findMatchingContact,
  hasMeaningfulContactDetails
} from "../lib/customer-contact-dedup";

const contacts = [
  {
    id: "contact-1",
    name: "Age Terpstra",
    department: "Keuring",
    phone: "06 12 34 56 78",
    email: "Age@TerpstraTrading.frl"
  }
];

test("contactgegevens worden hoofdletter-, spatie- en telefoonnotatie-onafhankelijk vergeleken", () => {
  assert.equal(
    contactIdentityKey(contacts[0]),
    contactIdentityKey({
      name: " age terpstra ",
      department: "keuring",
      phone: "0612345678",
      email: "age@terpstratrading.frl"
    })
  );
});

test("een keuring hergebruikt een bestaand contact als het id ontbreekt", () => {
  assert.equal(
    findMatchingContact(contacts, {
      name: "Age Terpstra",
      phone: "06-12345678",
      email: "age@terpstratrading.frl"
    })?.id,
    "contact-1"
  );
});

test("expliciet nieuw maakt geen dubbel contact met dezelfde gegevens", () => {
  assert.equal(
    findMatchingContact(
      contacts,
      {
        name: "Age Terpstra",
        department: "Keuring",
        phone: "0612345678",
        email: "AGE@TERPSTRATRADING.FRL"
      },
      { explicitNew: true }
    )?.id,
    "contact-1"
  );
});

test("lege contactvelden leveren nooit een nieuw contact op", () => {
  assert.equal(hasMeaningfulContactDetails({}), false);
  assert.equal(findMatchingContact(contacts, {}), null);
});

test("twee verschillende personen met dezelfde naam worden niet stil samengevoegd", () => {
  const ambiguous = [
    { id: "a", name: "Jan de Vries", email: "jan@voorbeeld.nl" },
    { id: "b", name: "Jan de Vries", email: "anderejan@voorbeeld.nl" }
  ];
  assert.equal(findMatchingContact(ambiguous, { name: "Jan de Vries" }), null);
});

test("een algemeen e-mailadres maakt verschillende personen niet gelijk", () => {
  const sharedMailbox = [
    { id: "a", name: "Ruurd van der Wal", email: "info@heftrucks.frl" },
    { id: "b", name: "Auke", email: "info@heftrucks.frl" }
  ];
  assert.equal(
    findMatchingContact(
      sharedMailbox,
      { name: "Nieuwe medewerker", email: "info@heftrucks.frl" },
      { explicitNew: true }
    ),
    null
  );
});
