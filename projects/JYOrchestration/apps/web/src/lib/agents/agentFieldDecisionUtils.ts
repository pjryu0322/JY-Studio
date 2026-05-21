/**
 * Shared field-decision helpers for read-only design evaluators.
 */

/** Counts checklist items and how many are satisfied. */
export function checklistCounts<T extends { readonly satisfied: boolean }>(items: readonly T[]) {
  return {
    count: items.length,
    satisfiedCount: items.filter((item) => item.satisfied).length,
  };
}

/** Deduplicates by normalized field name; first occurrence wins. */
export function uniqueFieldDecisions<T extends { readonly field: string }>(fields: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const field of fields) {
    const key = field.field.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(field);
  }
  return out;
}
