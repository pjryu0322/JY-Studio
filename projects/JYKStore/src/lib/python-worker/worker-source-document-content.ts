/**
 * Build SourceDocument content / typing from a Worker normalized document.
 *
 * The legacy quality gates (source validation, structure coverage, chunk quality)
 * read `SourceDocument.content` + `sourceType`. Worker ZIP previously created
 * SourceDocuments with empty content and `ETC`, so those gates stayed MISSING /
 * FAIL even after a successful knowledge build. This module maps Worker ND
 * sections into Store SourceDocument fields without inventing fake PASS reports.
 */
import type { SourceFormat, SourceType } from "@prisma/client";
import type { WorkerNormalizedDocument } from "@/lib/python-worker/worker-output-contract";

const SOURCE_TYPE_VALUES = new Set<string>([
  "PRODUCT_MANUAL",
  "INTEGRATION_GUIDE",
  "API_SPEC",
  "OPENAPI_SCHEMA",
  "ERROR_CODE_TABLE",
  "SAMPLE_CODE",
  "FAQ",
  "RELEASE_NOTE",
  "SECURITY_GUIDE",
  "TEST_ENV_GUIDE",
  "OPERATION_GUIDE",
  "CALLBACK_GUIDE",
  "TROUBLESHOOTING",
  "ETC",
]);

/** Cap stored content so a single huge ND cannot blow the DB row. */
const MAX_SOURCE_CONTENT_CHARS = 200_000;

type SectionLike = {
  heading?: unknown;
  content?: unknown;
  codeBlocks?: unknown;
};

function asSection(value: unknown): SectionLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as SectionLike;
}

function sectionText(section: SectionLike): string {
  const parts: string[] = [];
  if (typeof section.heading === "string" && section.heading.trim()) {
    parts.push(section.heading.trim());
  }
  if (typeof section.content === "string" && section.content.trim()) {
    parts.push(section.content.trim());
  }
  if (Array.isArray(section.codeBlocks)) {
    for (const block of section.codeBlocks) {
      if (!block || typeof block !== "object") continue;
      const code = (block as { content?: unknown }).content;
      if (typeof code === "string" && code.trim()) parts.push(code.trim());
    }
  }
  return parts.join("\n\n");
}

/**
 * Flatten Worker ND sections into a single SourceDocument content string.
 * Falls back to title when sections are empty so validation still has text.
 */
export function buildWorkerSourceDocumentContent(
  doc: WorkerNormalizedDocument,
): string {
  const parts: string[] = [];
  if (Array.isArray(doc.sections)) {
    for (const raw of doc.sections) {
      const section = asSection(raw);
      if (!section) continue;
      const text = sectionText(section);
      if (text) parts.push(text);
    }
  }
  let content = parts.join("\n\n\n").trim();
  if (!content) {
    const title = typeof doc.title === "string" ? doc.title.trim() : "";
    content = title || doc.sourcePath;
  }
  if (content.length > MAX_SOURCE_CONTENT_CHARS) {
    content = `${content.slice(0, MAX_SOURCE_CONTENT_CHARS)}\n\n…(truncated)`;
  }
  return content;
}

/**
 * Heuristic SourceType from Worker path / declared sourceType.
 * Prefer an explicit Prisma-compatible value; otherwise map common path cues so
 * structure coverage can match GENERIC_PRODUCT sections via sourceTypes (not
 * only keywords). Unknown → PRODUCT_MANUAL for doc-like files, else ETC.
 */
export function resolveWorkerSourceDocumentType(
  doc: WorkerNormalizedDocument,
): SourceType {
  const declared = doc.sourceType?.trim().toUpperCase();
  if (declared && SOURCE_TYPE_VALUES.has(declared)) {
    return declared as SourceType;
  }

  const haystack = `${doc.sourcePath} ${doc.title ?? ""} ${declared ?? ""}`.toLowerCase();
  if (/\b(openapi|swagger)\b/.test(haystack)) return "OPENAPI_SCHEMA";
  if (/\b(api[_-]?spec|api)\b/.test(haystack) || haystack.includes("api/")) return "API_SPEC";
  if (/\b(sample|example|예제|demo)\b/.test(haystack)) return "SAMPLE_CODE";
  if (/\b(faq|질문)\b/.test(haystack)) return "FAQ";
  if (/\b(error|오류|errcode)\b/.test(haystack)) return "ERROR_CODE_TABLE";
  if (/\b(security|보안)\b/.test(haystack)) return "SECURITY_GUIDE";
  if (/\b(changelog|release|변경|releasenote)\b/.test(haystack)) return "RELEASE_NOTE";
  if (/\b(troubleshoot|장애|문제)\b/.test(haystack)) return "TROUBLESHOOTING";
  if (/\b(callback|webhook)\b/.test(haystack)) return "CALLBACK_GUIDE";
  if (/\b(operation|운영|ops)\b/.test(haystack)) return "OPERATION_GUIDE";
  if (/\b(test|sandbox|테스트)\b/.test(haystack)) return "TEST_ENV_GUIDE";
  if (/\b(integrat|연동|guide)\b/.test(haystack)) return "INTEGRATION_GUIDE";

  const ext = doc.sourcePath.replace(/\\/g, "/").split(".").pop()?.toLowerCase() ?? "";
  if (["html", "htm", "md", "markdown", "txt", "pdf", "docx"].includes(ext)) {
    return "PRODUCT_MANUAL";
  }
  return "ETC";
}

export function resolveWorkerSourceDocumentFormat(
  doc: WorkerNormalizedDocument,
): SourceFormat {
  const ext = doc.sourcePath.replace(/\\/g, "/").split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "md":
    case "markdown":
      return "MARKDOWN";
    case "html":
    case "htm":
      return "HTML";
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
    case "xlsx":
      return "XLSX";
    case "csv":
      return "CSV";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
    case "java":
    case "py":
    case "cs":
      return "CODE";
    default:
      return "TEXT";
  }
}
