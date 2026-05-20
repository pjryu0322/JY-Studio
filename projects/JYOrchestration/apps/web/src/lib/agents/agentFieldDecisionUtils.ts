/**
 * Shared field-decision helpers for read-only design evaluators.
 */

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
