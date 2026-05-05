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

export function formatDisplayDate(value?: string | null) {
  const date = String(value ?? "").trim();
  if (!date) {
    return "-";
  }

  const isoDate = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return date;
  }

  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

export function formatDisplayDateTime(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "-";
  }

  const datePart = formatDisplayDate(raw);
  const timeMatch = raw.match(/(?:T|\s)(\d{2}:\d{2})/);
  return timeMatch ? `${datePart} ${timeMatch[1]}` : datePart;
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
