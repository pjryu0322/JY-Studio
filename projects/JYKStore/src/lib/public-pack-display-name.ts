/**
 * Normalize pack names that look like filenames into natural-language display names.
 * Provider-supplied display names should be preferred by callers; this is a fallback.
 */
export function normalizePublicPackDisplayName(raw: string): string {
  let value = raw.normalize("NFKC").trim();
  if (!value) return raw;

  // Strip common file extensions.
  value = value.replace(/\.(docx?|pdf|hwp|hwpx|pptx?|xlsx?|txt|md|zip)$/i, "");

  // Soften copy suffixes: " (1)", "_01", "-02", and glued "가이드01" (not 4-digit years).
  value = value.replace(/[\s_-]*\(\d{1,2}\)\s*$/u, "");
  value = value.replace(/[\s_-]+(?!\d{4}$)(\d{1,2})$/u, "");
  value = value.replace(/(\p{L})\d{1,2}$/u, "$1");

  // Underscores → spaces.
  value = value.replace(/_+/g, " ");

  // "(segment) rest" → "segment rest"
  value = value.replace(/^\(([^)]+)\)\s*/u, "$1 ");

  // Drop leftover empty parentheses and collapse whitespace.
  value = value.replace(/\(\s*\)/g, "");
  value = value.replace(/\s{2,}/g, " ").trim();

  return value || raw.trim();
}

export function resolvePublicPackDisplayName(input: {
  preferredDisplayName?: string | null;
  name: string;
}): string {
  const preferred = input.preferredDisplayName?.trim();
  if (preferred) return preferred;
  return normalizePublicPackDisplayName(input.name);
}
