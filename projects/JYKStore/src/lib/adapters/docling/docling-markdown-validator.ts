import { getDoclingUploadPolicy } from "@/lib/docling-import/docling-upload-policy";
import {
  DOCLING_MARKDOWN_VALIDATOR_VERSION,
  buildTextSamples,
  compareJsonMarkdownSimilarity,
  extractJsonTextSamples,
  type JsonMarkdownSimilarityMetrics,
  type SimilaritySampleDetail,
  type TextSamples,
} from "./docling-json-markdown-similarity";
import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type { DoclingDocument } from "./docling-types";
import { decodeUtf8 } from "./docling-validator";

export { DOCLING_MARKDOWN_VALIDATOR_VERSION };
export type { TextSamples, JsonMarkdownSimilarityMetrics };

/**
 * Align with Docling upload policy default (512 MiB). Prefer
 * `resolveMaxMarkdownBytes()` so env overrides are honored at runtime.
 */
export const MAX_MARKDOWN_BYTES = 536_870_912;

/** Preview / similarity sample size — do not hold entire huge markdown in memory. */
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

export type MarkdownValidationResult = {
  ok: boolean;
  text?: string;
  issues: DoclingIssue[];
  /** @deprecated Use metrics.jaccard — kept for backward compatibility. */
  similarity?: number;
  metrics?: JsonMarkdownSimilarityMetrics;
  samples?: SimilaritySampleDetail[];
  validatorVersion?: string;
};

export function extractJsonTextCorpus(doc: DoclingDocument): string {
  const parts: string[] = [];
  if (typeof doc.name === "string") parts.push(doc.name);
  if (Array.isArray(doc.texts)) {
    for (const item of doc.texts) {
      if (item && typeof item.text === "string" && item.text.trim()) {
        parts.push(item.text);
      }
    }
  }
  return parts.join("\n");
}

/**
 * Strip script tags and inline event handlers for safe markdown preview.
 * Does not execute HTML.
 */
export function sanitizeMarkdownForPreview(markdown: string): string {
  return markdown
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:text/html");
}

function applyMarkdownContentChecks(options: {
  text: string;
  markdownSamples?: TextSamples;
  document?: DoclingDocument;
  originFileName?: string;
  sourceFileName?: string;
  issues: DoclingIssue[];
}): {
  similarity?: number;
  metrics?: JsonMarkdownSimilarityMetrics;
  samples?: SimilaritySampleDetail[];
} {
  const { text, document, issues } = options;
  const controlMatches = text.match(CONTROL_CHAR_RE) ?? [];
  const controlRatio = controlMatches.length / Math.max(text.length, 1);
  if (controlMatches.length > 50 || controlRatio > 0.02) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        "Markdown contains excessive control characters.",
        { field: "markdown" },
      ),
    );
  } else if (controlMatches.length > 0) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "WARNING",
        "Markdown contains some control characters.",
        { field: "markdown" },
      ),
    );
  }

  if (!document) {
    return {};
  }

  const markdownSamples =
    options.markdownSamples ?? buildTextSamples(text);
  const jsonSamples = extractJsonTextSamples(document);
  const comparison = compareJsonMarkdownSimilarity({
    jsonSamples,
    markdownSamples,
    document,
    originFileName:
      options.originFileName ?? document.origin?.filename,
    sourceFileName: options.sourceFileName,
  });

  for (const i of comparison.issues) {
    issues.push(i);
  }

  return {
    similarity: comparison.metrics.jaccard,
    metrics: comparison.metrics,
    samples: comparison.samples,
  };
}

/**
 * Validate markdown from a streaming preview (non-empty UTF-8, size already checked).
 * Uses truncated preview / triple samples for similarity / control-char checks.
 */
export function validateDoclingMarkdownPreview(options: {
  textPreview: string;
  encodingOk: boolean;
  empty: boolean;
  byteLength: number;
  maxBytes?: number;
  document?: DoclingDocument;
  markdownSamples?: TextSamples;
  originFileName?: string;
  sourceFileName?: string;
}): MarkdownValidationResult {
  const issues: DoclingIssue[] = [];
  const maxBytes = options.maxBytes ?? resolveMaxMarkdownBytes();

  if (options.byteLength <= 0 || options.empty) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_EMPTY,
        "ERROR",
        "Markdown is empty.",
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  if (options.byteLength > maxBytes) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        `Markdown exceeds size limit of ${maxBytes} bytes.`,
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  if (!options.encodingOk) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        "Markdown is not valid UTF-8.",
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  const checked = applyMarkdownContentChecks({
    text: options.textPreview,
    markdownSamples: options.markdownSamples,
    document: options.document,
    originFileName: options.originFileName,
    sourceFileName: options.sourceFileName,
    issues,
  });
  const ok = !issues.some((i) => i.severity === "ERROR");
  return {
    ok,
    text: options.textPreview,
    issues,
    similarity: checked.similarity,
    metrics: checked.metrics,
    samples: checked.samples,
    validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
  };
}

export function validateDoclingMarkdown(options: {
  markdown?: string | Uint8Array | null;
  document?: DoclingDocument;
  maxBytes?: number;
  markdownSamples?: TextSamples;
  originFileName?: string;
  sourceFileName?: string;
}): MarkdownValidationResult {
  const issues: DoclingIssue[] = [];
  const { markdown, document } = options;
  const maxBytes = options.maxBytes ?? resolveMaxMarkdownBytes();

  if (markdown === undefined || markdown === null) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_REQUIRED,
        "ERROR",
        "Docling Markdown is required.",
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  if (markdown instanceof Uint8Array && markdown.byteLength > maxBytes) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        `Markdown exceeds size limit of ${maxBytes} bytes.`,
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  if (typeof markdown === "string") {
    const byteLength = new TextEncoder().encode(markdown).byteLength;
    if (byteLength > maxBytes) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
          "ERROR",
          `Markdown exceeds size limit of ${maxBytes} bytes.`,
          { field: "markdown" },
        ),
      );
      return {
        ok: false,
        issues,
        validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
      };
    }
  }

  const decoded = decodeUtf8(markdown);
  if (!decoded.ok) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        "Markdown is not valid UTF-8.",
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  const text = decoded.text;
  if (text.trim().length === 0) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_EMPTY,
        "ERROR",
        "Markdown is empty.",
        { field: "markdown" },
      ),
    );
    return {
      ok: false,
      issues,
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
    };
  }

  const checked = applyMarkdownContentChecks({
    text,
    markdownSamples: options.markdownSamples,
    document,
    originFileName: options.originFileName,
    sourceFileName: options.sourceFileName,
    issues,
  });
  const ok = !issues.some((i) => i.severity === "ERROR");
  return {
    ok,
    text,
    issues,
    similarity: checked.similarity,
    metrics: checked.metrics,
    samples: checked.samples,
    validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
  };
}
