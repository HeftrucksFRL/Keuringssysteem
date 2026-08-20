import type { CustomerRecord } from "@/lib/domain";

function normalizeRentalOwnerText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

const STOCK_CUSTOMER_ALIASES = [
  "heftrucks frl",
  "heftrucks friesland",
  "heftrucks friesland b v",
  "heftrucks friesland bv",
  "terpstra trading",
  "terpstra trading b v",
  "terpstra trading bv"
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
  const company = normalizeRentalOwnerText(customer?.companyName)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return STOCK_CUSTOMER_ALIASES.includes(company);
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
