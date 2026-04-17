export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayLocalIso() {
  return formatLocalDateInput(new Date());
}

export function addTwelveMonths(date: string) {
  const current = parseLocalDateInput(date);
  if (Number.isNaN(current.getTime())) {
    return "";
  }

  current.setFullYear(current.getFullYear() + 1);
  return formatLocalDateInput(current);
}
