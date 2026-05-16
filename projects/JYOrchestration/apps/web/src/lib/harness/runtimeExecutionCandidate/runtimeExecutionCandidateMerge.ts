/**
 * H23 — 공용 문자열 병합·정렬(read-only harness 내부).
 */

export function mergeSortedUniqueKo(rows: readonly string[]): readonly string[] {
  return [...new Set(rows.map((s) => String(s ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}
