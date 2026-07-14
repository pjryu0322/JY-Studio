import { getDoclingUploadPolicy } from "@/lib/docling-import/docling-upload-policy";
import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import { decodeUtf8 } from "./docling-validator";

/**
 * Soft markdown preview validator version.
 * Semantic JSON↔Markdown similarity is no longer a registration gate.
 */
export const DOCLING_MARKDOWN_VALIDATOR_VERSION = "3.0.0";

/**
 * Align with Docling upload policy default (512 MiB). Prefer
 * `resolveMaxMarkdownBytes()` so env overrides are honored at runtime.
 */
export const MAX_MARKDOWN_BYTES = 536_870_912;

/** Preview sample size — do not hold entire huge markdown in memory. */
export const MARKDOWN_PREVIEW_MAX_BYTES = 100 * 1024;

/** Below this size, validate may decode the full markdown into a string. */
export const MARKDOWN_FULL_BUFFER_MAX_BYTES = 2 * 1024 * 1024;

export function resolveMaxMarkdownBytes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  try {
    return getDoclingUploadPolicy(env).maxMarkdownBytes;
  } catch {
    return MAX_MARKDOWN_BYTES;
  }
}

const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Soft / auxiliary markdown validation result.
 * Empty, UTF-8, and encoding issues are WARNINGs only — never hard ERROR gates.
 * `ok` is true whenever there is no ERROR (soft issues leave ok=true).
 */
export type MarkdownValidationResult = {
  ok: boolean;
  available: boolean;
  previewAvailable: boolean;
  warnings: DoclingIssue[];
  issues: DoclingIssue[];
  textPreview?: string;
  text?: string;
  validatorVersion?: string;
  /** @deprecated Similarity diagnostics removed from gate; kept nullable for Admin report compat. */
  similarity?: number;
  /** @deprecated */
  metrics?: null;
  /** @deprecated */
  samples?: null;
};

export function sanitizeMarkdownForPreview(markdown: string): string {
  return markdown
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:text/html");
}

function softResult(partial: {
  available: boolean;
  previewAvailable: boolean;
  warnings: DoclingIssue[];
  textPreview?: string;
  text?: string;
}): MarkdownValidationResult {
  const warnings = partial.warnings;
  return {
    ok: true,
    available: partial.available,
    previewAvailable: partial.previewAvailable,
    warnings,
    issues: warnings,
    textPreview: partial.textPreview,
    text: partial.text,
    validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    metrics: null,
    samples: null,
  };
}

function applySoftContentChecks(text: string, warnings: DoclingIssue[]): void {
  const controlMatches = text.match(CONTROL_CHAR_RE) ?? [];
  const controlRatio = controlMatches.length / Math.max(text.length, 1);
  if (controlMatches.length > 50 || controlRatio > 0.02) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "WARNING",
        "Markdown contains excessive control characters.",
        { field: "markdown" },
      ),
    );
  } else if (controlMatches.length > 0) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "WARNING",
        "Markdown contains some control characters.",
        { field: "markdown" },
      ),
    );
  }
}

/**
 * Soft validation for a streaming markdown preview.
 * Presence/size/UTF-8/empty only — never emits semantic mismatch ERRORs.
 */
export function validateDoclingMarkdownPreview(options: {
  textPreview: string;
  encodingOk: boolean;
  empty: boolean;
  byteLength: number;
  maxBytes?: number;
}): MarkdownValidationResult {
  const warnings: DoclingIssue[] = [];
  const maxBytes = options.maxBytes ?? resolveMaxMarkdownBytes();

  if (options.byteLength <= 0 || options.empty) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_EMPTY,
        "WARNING",
        "Markdown is empty.",
        { field: "markdown" },
      ),
    );
    return softResult({
      available: true,
      previewAvailable: false,
      warnings,
    });
  }

  if (options.byteLength > maxBytes) {
    // Oversize is a resource/policy issue, not soft preview content.
    const issues = [
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        `Markdown exceeds size limit of ${maxBytes} bytes.`,
        { field: "markdown" },
      ),
    ];
    return {
      ok: false,
      available: true,
      previewAvailable: false,
      warnings: [],
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
      metrics: null,
      samples: null,
    };
  }

  if (!options.encodingOk) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "WARNING",
        "Markdown is not valid UTF-8.",
        { field: "markdown" },
      ),
    );
    return softResult({
      available: true,
      previewAvailable: false,
      warnings,
    });
  }

  applySoftContentChecks(options.textPreview, warnings);
  const preview = options.textPreview.slice(0, MARKDOWN_PREVIEW_MAX_BYTES);
  return softResult({
    available: true,
    previewAvailable: preview.trim().length > 0,
    warnings,
    textPreview: preview,
    text: preview,
  });
}

/**
 * Soft markdown checks. Absence is not an error (optional auxiliary content).
 * Does not compare JSON↔Markdown semantically.
 */
export function validateDoclingMarkdown(options: {
  markdown?: string | Uint8Array | null;
  maxBytes?: number;
}): MarkdownValidationResult {
  const warnings: DoclingIssue[] = [];
  const { markdown } = options;
  const maxBytes = options.maxBytes ?? resolveMaxMarkdownBytes();

  if (markdown === undefined || markdown === null) {
    return softResult({
      available: false,
      previewAvailable: false,
      warnings: [],
    });
  }

  if (markdown instanceof Uint8Array && markdown.byteLength > maxBytes) {
    const issues = [
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        `Markdown exceeds size limit of ${maxBytes} bytes.`,
        { field: "markdown" },
      ),
    ];
    return {
      ok: false,
      available: true,
      previewAvailable: false,
      warnings: [],
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
      metrics: null,
      samples: null,
    };
  }

  if (typeof markdown === "string") {
    const byteLength = new TextEncoder().encode(markdown).byteLength;
    if (byteLength > maxBytes) {
      const issues = [
        issue(
          DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
          "ERROR",
          `Markdown exceeds size limit of ${maxBytes} bytes.`,
          { field: "markdown" },
        ),
      ];
      return {
        ok: false,
        available: true,
        previewAvailable: false,
        warnings: [],
        issues,
        validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
        metrics: null,
        samples: null,
      };
    }
  }

  const decoded = decodeUtf8(markdown);
  if (!decoded.ok) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "WARNING",
        "Markdown is not valid UTF-8.",
        { field: "markdown" },
      ),
    );
    return softResult({
      available: true,
      previewAvailable: false,
      warnings,
    });
  }

  const text = decoded.text;
  if (text.trim().length === 0) {
    warnings.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_EMPTY,
        "WARNING",
        "Markdown is empty.",
        { field: "markdown" },
      ),
    );
    return softResult({
      available: true,
      previewAvailable: false,
      warnings,
    });
  }

  applySoftContentChecks(text, warnings);
  const preview = text.slice(0, MARKDOWN_PREVIEW_MAX_BYTES);
  return softResult({
    available: true,
    previewAvailable: true,
    warnings,
    textPreview: preview,
    text,
  });
}
