import type { CustomerRecord } from "@/lib/domain";

function normalizeRentalOwnerText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

const STOCK_CUSTOMER_ALIASES = [
  "heftrucks.frl",
  "heftrucks friesland",
  "heftrucks friesland b.v",
  "heftrucks friesland bv",
  "terpstra trading",
  "terpstra trading b.v",
  "terpstra trading bv"
];

const STOCK_CUSTOMER_EMAIL_MARKERS = [
  "@heftrucks.frl",
  "heftrucks.frl",
  "@terpstratrading.frl",
  "terpstratrading.frl"
];

const HISTORY_CUSTOMER_ALIASES = [
  "historiebak",
  "historie bak",
  "historie machines"
];

export function stockOwnerLabel() {
  return "Eigen voorraad - Heftrucks.frl";
}

export function historyOwnerLabel() {
  return "Historiebak";
}

export function isRentalStockCustomer(
  customer?: Pick<CustomerRecord, "companyName" | "email"> | null
) {
  const company = normalizeRentalOwnerText(customer?.companyName);
  const email = normalizeRentalOwnerText(customer?.email);
  return (
    STOCK_CUSTOMER_ALIASES.some((alias) => company.includes(alias)) ||
    STOCK_CUSTOMER_EMAIL_MARKERS.some((marker) => email.includes(marker))
  );
}

export function isMachineHistoryCustomer(
  customer?: Pick<CustomerRecord, "companyName" | "email"> | null
) {
  const company = normalizeRentalOwnerText(customer?.companyName);
  return HISTORY_CUSTOMER_ALIASES.some((alias) => company.includes(alias));
}

export function getCustomerDisplayName(
  customer?: Pick<CustomerRecord, "companyName" | "email"> | null
) {
  if (!customer) {
    return "Onbekende klant";
  }

  if (isRentalStockCustomer(customer)) {
    return stockOwnerLabel();
  }

  return isMachineHistoryCustomer(customer) ? historyOwnerLabel() : customer.companyName;
}
