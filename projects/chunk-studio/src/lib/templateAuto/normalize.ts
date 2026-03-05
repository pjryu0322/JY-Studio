export function normalizeText(input: string): string {
  return input
    .replace(/[\u2022\u25cf\u25a0\u00b7]/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function normalizeLabel(input: string): string {
  return normalizeText(input)
    .replace(/[:：]+$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeDate(input: string): string {
  const text = normalizeText(input);
  const m = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!m) return text;
  const y = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
