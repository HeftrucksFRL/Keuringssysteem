export function getYearSequenceStart(year: number) {
  const yearSuffix = Number(String(year).slice(-2));
  return yearSuffix * 1000 + 1;
}

export function formatInspectionNumber(sequence: number) {
  return String(sequence).padStart(5, "0");
}

export function previewNextInspectionNumber(
  year: number,
  lastSequenceForYear?: number | null
) {
  const base = getYearSequenceStart(year);
  const next = lastSequenceForYear && lastSequenceForYear >= base
    ? lastSequenceForYear + 1
    : base;

  return formatInspectionNumber(next);
}
