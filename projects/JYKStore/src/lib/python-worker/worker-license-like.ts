/**
 * License / EULA-like path heuristics shared by Worker ZIP SourceDocument
 * persistence, source validation, and the admin correction queue.
 *
 * Aligned with python-worker `is_license_filename` intent, but intentionally
 * narrower than Worker LICENSE_NAME_PATTERNS (excludes broad tokens like
 * `readme` / `terms` so product manuals are not dropped from quality).
 */

const LICENSE_BASENAME_RE =
  /(^|[._-])(license|licence|라이선스|사용권|copyright|eula)([._-]|$)/i;

export function isLicenseLikePath(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const normalized = value.trim().replace(/\\/g, "/");
  const base = normalized.split("/").pop() ?? normalized;
  if (LICENSE_BASENAME_RE.test(base)) return true;
  if (/^(license|licence|라이선스|사용권|copyright|eula)(\.|$)/i.test(base)) return true;
  return false;
}

export function isLicenseLikeSourceDocument(doc: {
  readonly title?: string | null;
  readonly fileName?: string | null;
  readonly sourcePath?: string | null;
}): boolean {
  return (
    isLicenseLikePath(doc.sourcePath) ||
    isLicenseLikePath(doc.fileName) ||
    isLicenseLikePath(doc.title)
  );
}

export function isWorkerReviewOnlyDocument(doc: {
  readonly sourceType?: string | null;
  readonly reviewOnly?: unknown;
  readonly sourcePath?: string | null;
  readonly title?: string | null;
}): boolean {
  const sourceType = doc.sourceType?.trim().toLowerCase() ?? "";
  if (sourceType === "license_review") return true;
  if (doc.reviewOnly === true) return true;
  return isLicenseLikeSourceDocument(doc);
}
