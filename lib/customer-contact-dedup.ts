export interface ContactIdentity {
  id?: string;
  name?: string;
  department?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ");
}

function normalizePhone(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

export function hasMeaningfulContactDetails(contact: ContactIdentity) {
  return Boolean(
    normalizeText(contact.name) ||
      normalizeText(contact.department) ||
      normalizePhone(contact.phone) ||
      normalizeText(contact.email)
  );
}

export function contactIdentityKey(contact: ContactIdentity) {
  return [
    normalizeText(contact.name),
    normalizeText(contact.department),
    normalizePhone(contact.phone),
    normalizeText(contact.email)
  ].join("|");
}

export function findMatchingContact<T extends ContactIdentity>(
  contacts: T[],
  input: ContactIdentity,
  options: { explicitNew?: boolean } = {}
) {
  if (!hasMeaningfulContactDetails(input)) return null;

  const exactKey = contactIdentityKey(input);
  const exact = contacts.find((contact) => contactIdentityKey(contact) === exactKey);
  if (exact) return exact;

  const email = normalizeText(input.email);
  const name = normalizeText(input.name);
  if (email && name) {
    const emailMatches = contacts.filter(
      (contact) =>
        normalizeText(contact.email) === email && normalizeText(contact.name) === name
    );
    if (emailMatches.length === 1) return emailMatches[0];
  }

  if (options.explicitNew) return null;

  const department = normalizeText(input.department);
  const phone = normalizePhone(input.phone);
  const compatible = contacts.filter((contact) => {
    if (name && normalizeText(contact.name) !== name) return false;
    if (email && normalizeText(contact.email) !== email) return false;
    if (department && normalizeText(contact.department) !== department) return false;
    if (phone && normalizePhone(contact.phone) !== phone) return false;
    return true;
  });

  return compatible.length === 1 ? compatible[0] : null;
}
