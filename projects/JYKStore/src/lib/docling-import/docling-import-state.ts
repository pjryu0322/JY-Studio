import { DoclingImportBundleStatus } from "@prisma/client";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";

const ALLOWED_TRANSITIONS: Record<DoclingImportBundleStatus, DoclingImportBundleStatus[]> = {
  UPLOADED: [DoclingImportBundleStatus.VALIDATING],
  VALIDATING: [
    DoclingImportBundleStatus.VALID,
    DoclingImportBundleStatus.VALIDATION_FAILED,
  ],
  VALIDATION_FAILED: [DoclingImportBundleStatus.VALIDATING],
  VALID: [DoclingImportBundleStatus.NORMALIZING],
  NORMALIZING: [
    DoclingImportBundleStatus.NORMALIZED,
    DoclingImportBundleStatus.NORMALIZATION_FAILED,
  ],
  NORMALIZED: [
    DoclingImportBundleStatus.REVIEW_READY,
    DoclingImportBundleStatus.VALIDATING,
  ],
  NORMALIZATION_FAILED: [DoclingImportBundleStatus.VALIDATING],
  REVIEW_READY: [],
};

/** Transient / infra failures — same files may succeed on retry. */
export const DOCLING_RETRYABLE_ERROR_CODES = new Set([
  "DOCLING_STORAGE_UNAVAILABLE",
  "DOCLING_CONFLICT",
  "DOCLING_NORMALIZATION_TRANSIENT_FAILURE",
  "DOCLING_RETRY_FAILED",
  "DOCLING_ACTIVE_BUNDLE_CONFLICT",
]);

/** Content/schema failures — retrying the same files will not help. */
export const DOCLING_NON_RETRYABLE_ERROR_CODES = new Set([
  "DOCLING_SCHEMA_INVALID",
  "DOCLING_ORIGIN_MISMATCH",
  "SOURCE_FILENAME_MISMATCH",
  "SOURCE_MIMETYPE_MISMATCH",
  "DOCLING_JSON_MARKDOWN_MISMATCH",
  "DOCLING_INCOMPLETE_FILES",
  "DOCLING_FILE_SIGNATURE_MISMATCH",
  "DOCLING_FILE_CONTENT_INVALID",
  "DOCLING_HTML_CONTENT_INVALID",
  "DOCLING_OFFICE_PACKAGE_INVALID",
  "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
  "DOCLING_ENTITY_LIMIT_EXCEEDED",
  "DOCLING_VALIDATION_FAILED",
]);

export function assertTransition(
  from: DoclingImportBundleStatus,
  to: DoclingImportBundleStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DoclingImportError(
      "DOCLING_INVALID_TRANSITION",
      `Docling import 상태 전환이 허용되지 않습니다: ${from} → ${to}`,
      409,
    );
  }
}

export function canRetry(status: DoclingImportBundleStatus): boolean {
  return canRetryDoclingBundle(status, null);
}

export function canRetryDoclingBundle(
  status: DoclingImportBundleStatus,
  lastErrorCode?: string | null,
): boolean {
  const statusOk =
    status === DoclingImportBundleStatus.VALIDATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZED;
  if (!statusOk) return false;

  const code = lastErrorCode?.trim() || "";
  if (!code) return true;
  if (DOCLING_NON_RETRYABLE_ERROR_CODES.has(code)) return false;
  if (DOCLING_RETRYABLE_ERROR_CODES.has(code)) return true;
  // Unknown codes: allow retry for NORMALIZATION_FAILED / NORMALIZED; block clear validation mismatches.
  if (status === DoclingImportBundleStatus.VALIDATION_FAILED) {
    return !code.includes("MISMATCH") && !code.includes("INVALID") && !code.includes("SCHEMA");
  }
  return true;
}

export function getAllowedTransitions(
  from: DoclingImportBundleStatus,
): DoclingImportBundleStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
