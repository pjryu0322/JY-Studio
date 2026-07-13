/**
 * Normalize pack names that look like filenames into natural-language display names.
 * Provider-supplied display names should be preferred by callers; this is a fallback.
 *
 * Safe rules only: do NOT strip product/version digits (OAuth2, GPT-4, Java 17, …).
 */
export function normalizePublicPackDisplayName(raw: string): string {
  let value = raw.normalize("NFKC").trim();
  if (!value) return raw;

  // Strip common file extensions.
  value = value.replace(/\.(docx?|pdf|hwp|hwpx|pptx?|xlsx?|txt|md|zip)$/i, "");

  // Remove only explicit copy markers like " (1)" / "(2)" at the end.
  value = value.replace(/\s*\(\d{1,2}\)\s*$/u, "");

  // Underscores → spaces.
  value = value.replace(/_+/g, " ");

  // "(segment) rest" → "segment rest"
  value = value.replace(/^\(([^)]+)\)\s*/u, "$1 ");

  // Drop leftover empty parentheses and collapse whitespace.
  value = value.replace(/\(\s*\)/g, "");
  value = value.replace(/\s{2,}/g, " ").trim();

  return value || raw.trim();
}

/**
 * Optional filename-oriented cleanup for download labels only.
 * Keeps trailing product digits; only softens obvious copy suffixes like "_01" / " (1)".
 */
export function normalizeSourceFileDisplayName(raw: string): string {
  let value = raw.normalize("NFKC").trim();
  if (!value) return raw;
  value = value.replace(/\s*\(\d{1,2}\)\s*(?=\.[^.]+$|$)/u, "");
  return value.trim() || raw.trim();
}

export function resolvePublicPackDisplayName(input: {
  preferredDisplayName?: string | null;
  name: string;
}): string {
  const preferred = input.preferredDisplayName?.trim();
  if (preferred) return preferred;
  return normalizePublicPackDisplayName(input.name);
}
