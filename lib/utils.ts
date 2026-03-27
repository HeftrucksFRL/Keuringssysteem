export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function addTwelveMonths(date: string) {
  const current = new Date(date);
  if (Number.isNaN(current.getTime())) {
    return "";
  }

  current.setFullYear(current.getFullYear() + 1);
  return current.toISOString().slice(0, 10);
}
