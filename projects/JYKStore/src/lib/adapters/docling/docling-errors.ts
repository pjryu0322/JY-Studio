export const DOCLING_ERROR_CODES = {
  DOCLING_JSON_REQUIRED: "DOCLING_JSON_REQUIRED",
  DOCLING_JSON_EMPTY: "DOCLING_JSON_EMPTY",
  DOCLING_JSON_PARSE_FAILED: "DOCLING_JSON_PARSE_FAILED",
  DOCLING_SCHEMA_INVALID: "DOCLING_SCHEMA_INVALID",
  DOCLING_VERSION_REQUIRED: "DOCLING_VERSION_REQUIRED",
  DOCLING_ORIGIN_REQUIRED: "DOCLING_ORIGIN_REQUIRED",
  DOCLING_ORIGIN_FILENAME_REQUIRED: "DOCLING_ORIGIN_FILENAME_REQUIRED",
  DOCLING_ORIGIN_MIMETYPE_REQUIRED: "DOCLING_ORIGIN_MIMETYPE_REQUIRED",
  DOCLING_BODY_REQUIRED: "DOCLING_BODY_REQUIRED",
  DOCLING_REFERENCE_INVALID: "DOCLING_REFERENCE_INVALID",
  SOURCE_FILENAME_MISMATCH: "SOURCE_FILENAME_MISMATCH",
  SOURCE_MIMETYPE_MISMATCH: "SOURCE_MIMETYPE_MISMATCH",
  DOCLING_MARKDOWN_REQUIRED: "DOCLING_MARKDOWN_REQUIRED",
  DOCLING_MARKDOWN_EMPTY: "DOCLING_MARKDOWN_EMPTY",
  DOCLING_MARKDOWN_INVALID_ENCODING: "DOCLING_MARKDOWN_INVALID_ENCODING",
  /** @deprecated Soft-auxiliary Markdown policy: no longer emitted on new validations. */
  DOCLING_JSON_MARKDOWN_MISMATCH: "DOCLING_JSON_MARKDOWN_MISMATCH",
  /** @deprecated Soft-auxiliary Markdown policy: no longer emitted on new validations. */
  DOCLING_JSON_MARKDOWN_INCONCLUSIVE: "DOCLING_JSON_MARKDOWN_INCONCLUSIVE",
  /** @deprecated Soft-auxiliary Markdown policy: no longer emitted on new validations. */
  DOCLING_JSON_MARKDOWN_LOW_COVERAGE: "DOCLING_JSON_MARKDOWN_LOW_COVERAGE",
  /** @deprecated Soft-auxiliary Markdown policy: no longer emitted on new validations. */
  DOCLING_VALIDATOR_VERSION_OUTDATED: "DOCLING_VALIDATOR_VERSION_OUTDATED",
  DOCLING_REVALIDATION_NOT_ALLOWED: "DOCLING_REVALIDATION_NOT_ALLOWED",
  DOCLING_ENTITY_LIMIT_EXCEEDED: "DOCLING_ENTITY_LIMIT_EXCEEDED",
  DOCUMENT_STRUCTURE_WARNING: "DOCUMENT_STRUCTURE_WARNING",
  DOCUMENT_TITLE_WARNING: "DOCUMENT_TITLE_WARNING",
  DOCUMENT_TITLE_MISMATCH: "DOCUMENT_TITLE_MISMATCH",
  DOCUMENT_LANGUAGE_MISMATCH: "DOCUMENT_LANGUAGE_MISMATCH",
} as const;

export type DoclingErrorCode =
  (typeof DOCLING_ERROR_CODES)[keyof typeof DOCLING_ERROR_CODES];

export type DoclingIssueSeverity = "ERROR" | "WARNING";

export type DoclingIssue = {
  code: DoclingErrorCode;
  severity: DoclingIssueSeverity;
  field?: string;
  message: string;
  hint?: string;
};

export function issue(
  code: DoclingErrorCode,
  severity: DoclingIssueSeverity,
  message: string,
  options?: { field?: string; hint?: string },
): DoclingIssue {
  return {
    code,
    severity,
    message,
    ...(options?.field !== undefined ? { field: options.field } : {}),
    ...(options?.hint !== undefined ? { hint: options.hint } : {}),
  };
}
