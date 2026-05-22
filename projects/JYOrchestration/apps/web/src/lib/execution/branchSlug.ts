/**
 * ASCII-safe branch slug segments (GitHub / automation friendly).
 */

/** When true, manual strategy keeps baseBranch (legacy behavior). */
export function isExecutionAllowManualStayOnBase(): boolean {
  return process.env.EXECUTION_ALLOW_MANUAL_STAY_ON_BASE === "1";
}

/**
 * Produce an ASCII branch slug segment from project/task labels.
 * Falls back when input is empty or has no ASCII letters/digits (e.g. Korean-only).
 */
export function toSafeBranchSlug(input: string, fallback: string, max = 32): string {
  const normalized = String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, max);

  if (!normalized || !/[a-z0-9]/.test(normalized)) {
    const fb = String(fallback ?? "project")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, max);
    return fb || "project";
  }
  return normalized;
}

export function shortIdFromUuid(id: string, len = 8): string {
  const s = String(id ?? "").replace(/-/g, "");
  return (s.slice(0, len) || "00000000").toLowerCase();
}
