import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type { DoclingDocument } from "./docling-types";
import { decodeUtf8 } from "./docling-validator";

/** Soft size cap for markdown payloads (20 MiB). */
export const MAX_MARKDOWN_BYTES = 20 * 1024 * 1024;

const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type MarkdownValidationResult = {
  ok: boolean;
  text?: string;
  issues: DoclingIssue[];
  similarity?: number;
};

function stripMarkdownSyntax(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/\|/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function tokenize(text: string): Set<string> {
  const normalized = text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return new Set();
  const tokens = normalized.split(" ").filter((t) => t.length >= 2);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

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

export function validateDoclingMarkdown(options: {
  markdown?: string | Uint8Array | null;
  document?: DoclingDocument;
}): MarkdownValidationResult {
  const issues: DoclingIssue[] = [];
  const { markdown, document } = options;

  if (markdown === undefined || markdown === null) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_REQUIRED,
        "ERROR",
        "Docling Markdown is required.",
        { field: "markdown" },
      ),
    );
    return { ok: false, issues };
  }

  if (markdown instanceof Uint8Array && markdown.byteLength > MAX_MARKDOWN_BYTES) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
        "ERROR",
        `Markdown exceeds size limit of ${MAX_MARKDOWN_BYTES} bytes.`,
        { field: "markdown" },
      ),
    );
    return { ok: false, issues };
  }

  if (typeof markdown === "string") {
    const byteLength = new TextEncoder().encode(markdown).byteLength;
    if (byteLength > MAX_MARKDOWN_BYTES) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_MARKDOWN_INVALID_ENCODING,
          "ERROR",
          `Markdown exceeds size limit of ${MAX_MARKDOWN_BYTES} bytes.`,
          { field: "markdown" },
        ),
      );
      return { ok: false, issues };
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
    return { ok: false, issues };
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
    return { ok: false, issues };
  }

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
    return { ok: false, issues };
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

  let similarity: number | undefined;
  if (document) {
    const jsonCorpus = extractJsonTextCorpus(document);
    const jsonTokens = tokenize(jsonCorpus);
    const mdTokens = tokenize(stripMarkdownSyntax(text));
    similarity = jaccard(jsonTokens, mdTokens);

    if (jsonTokens.size > 0 && mdTokens.size > 0) {
      if (similarity < 0.02) {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_MISMATCH,
            "ERROR",
            "Markdown content appears unrelated to Docling JSON text entities.",
            {
              field: "markdown",
              hint: "동일 문서에서 생성된 Docling JSON·Markdown 쌍인지 확인하세요.",
            },
          ),
        );
      } else if (similarity < 0.15) {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_MISMATCH,
            "WARNING",
            "Markdown content has low similarity to Docling JSON text entities.",
            { field: "markdown" },
          ),
        );
      }
    }
  }

  const ok = !issues.some((i) => i.severity === "ERROR");
  return { ok, text, issues, similarity };
}
