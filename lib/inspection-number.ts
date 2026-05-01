export function getYearSequenceStart(year: number) {
  return year * 10000 + 1;
}

export function formatInspectionNumber(sequence: number) {
  return String(sequence).padStart(8, "0");
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
