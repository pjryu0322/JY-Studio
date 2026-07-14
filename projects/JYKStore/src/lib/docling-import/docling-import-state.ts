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

/**
 * Transient / infra issues that can be re-checked against already-stored objects
 * without re-uploading. Markdown preview/soft issues are NOT revalidate reasons.
 * Legacy MISMATCH / INCONCLUSIVE / LOW_COVERAGE / VALIDATOR_VERSION_OUTDATED
 * codes are no longer UI revalidate triggers.
 */
export const DOCLING_REVALIDATE_ERROR_CODES = new Set([
  "DOCLING_VALIDATION_FAILED",
  ...DOCLING_RETRYABLE_ERROR_CODES,
]);

/** Content/schema failures — need new files (re-upload), not the same bytes again. */
export const DOCLING_NON_RETRYABLE_ERROR_CODES = new Set([
  "DOCLING_SCHEMA_INVALID",
  "DOCLING_ORIGIN_MISMATCH",
  "SOURCE_FILENAME_MISMATCH",
  "SOURCE_MIMETYPE_MISMATCH",
  "DOCLING_INCOMPLETE_FILES",
  "DOCLING_FILE_SIGNATURE_MISMATCH",
  "DOCLING_FILE_CONTENT_INVALID",
  "DOCLING_HTML_CONTENT_INVALID",
  "DOCLING_OFFICE_PACKAGE_INVALID",
  "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING",
  "DOCLING_ENTITY_LIMIT_EXCEEDED",
  "DOCLING_JSON_REQUIRED",
  "DOCLING_JSON_EMPTY",
  "DOCLING_JSON_PARSE_FAILED",
]);

/** Alias: clear integrity / origin mismatches require re-upload. */
export const DOCLING_REUPLOAD_ERROR_CODES = DOCLING_NON_RETRYABLE_ERROR_CODES;

export type DoclingRetryMode =
  | "REVALIDATE_STORED_OBJECTS"
  | "REUPLOAD_REQUIRED"
  | "NOT_ALLOWED";

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

export function resolveDoclingRetryMode(
  status: DoclingImportBundleStatus,
  lastErrorCode?: string | null,
  options?: {
    immutable?: boolean;
    deleted?: boolean;
    storageActive?: boolean;
  },
): DoclingRetryMode {
  if (options?.immutable) return "NOT_ALLOWED";
  if (options?.deleted) return "NOT_ALLOWED";
  if (options?.storageActive === false) return "NOT_ALLOWED";

  if (
    status === DoclingImportBundleStatus.VALIDATING ||
    status === DoclingImportBundleStatus.NORMALIZING
  ) {
    return "NOT_ALLOWED";
  }

  const failedLike =
    status === DoclingImportBundleStatus.VALIDATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZED;
  if (!failedLike) return "NOT_ALLOWED";

  const code = lastErrorCode?.trim() || "";
  if (!code) return "REVALIDATE_STORED_OBJECTS";

  if (DOCLING_REUPLOAD_ERROR_CODES.has(code)) return "REUPLOAD_REQUIRED";
  if (DOCLING_REVALIDATE_ERROR_CODES.has(code)) {
    return "REVALIDATE_STORED_OBJECTS";
  }

  // Unknown codes on validation failure: treat schema/origin/checksum as reupload
  if (status === DoclingImportBundleStatus.VALIDATION_FAILED) {
    if (
      code.includes("SCHEMA") ||
      code.includes("ORIGIN") ||
      code.includes("CHECKSUM") ||
      code.includes("SIGNATURE") ||
      code.includes("MIME") ||
      (code.includes("MISMATCH") && !code.includes("JSON_MARKDOWN")) ||
      code === "DOCLING_JSON_REQUIRED" ||
      code === "DOCLING_JSON_PARSE_FAILED" ||
      code === "DOCLING_INCOMPLETE_FILES"
    ) {
      return "REUPLOAD_REQUIRED";
    }
  }

  return "REVALIDATE_STORED_OBJECTS";
}

export function canRetryDoclingBundle(
  status: DoclingImportBundleStatus,
  lastErrorCode?: string | null,
  options?: {
    immutable?: boolean;
    deleted?: boolean;
    storageActive?: boolean;
  },
): boolean {
  return (
    resolveDoclingRetryMode(status, lastErrorCode, options) !== "NOT_ALLOWED"
  );
}

export function getAllowedTransitions(
  from: DoclingImportBundleStatus,
): DoclingImportBundleStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
