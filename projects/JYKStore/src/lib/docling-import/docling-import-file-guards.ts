import type { KnowledgePackFileRole } from "@prisma/client";
import { getPayloadLimitConfig } from "@/lib/distribution/payload-limit-config";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";

export const DOCLING_SOURCE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".html",
  ".htm",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
] as const;

export const DOCLING_JSON_EXTENSIONS = [".json"] as const;
export const DOCLING_MARKDOWN_EXTENSIONS = [".md"] as const;

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".js",
  ".mjs",
  ".cjs",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".dll",
  ".com",
  ".vbs",
  ".scr",
  ".jar",
  ".php",
  ".py",
  ".rb",
  ".pl",
  ".wasm",
]);

const SOURCE_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html",
  ".htm": "text/html",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
};

const JSON_MIME_TYPES = new Set(["application/json"]);
const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/plain"]);

export function extensionOfFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function sanitizeOriginalFileName(fileName: string, fallback = "file.bin"): string {
  if (fileName.includes("\0")) {
    throw new DoclingImportError(
      "DOCLING_UNSAFE_FILE_NAME",
      "파일 이름에 허용되지 않은 문자가 포함되어 있습니다.",
      400,
    );
  }
  const base = fileName.split(/[/\\]/).pop()?.trim() || fallback;
  if (!base || base === "." || base === "..") {
    throw new DoclingImportError(
      "DOCLING_UNSAFE_FILE_NAME",
      "파일 이름이 올바르지 않습니다.",
      400,
    );
  }
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned || fallback;
}

export function detectMimeFromExtension(extension: string): string | null {
  const ext = extension.toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  return SOURCE_MIME_BY_EXT[ext] ?? null;
}

function resolveMaxFileBytes(): number {
  const limits = getPayloadLimitConfig();
  return Math.min(limits.maxSingleEntryBytes, limits.maxZipBytes);
}

function assertNoPathTraversal(rawFileName: string): void {
  if (
    rawFileName.includes("\0") ||
    /(^|[/\\])\.\.([/\\]|$)/.test(rawFileName) ||
    /^[a-zA-Z]:[\\/]/.test(rawFileName) ||
    rawFileName.startsWith("/") ||
    rawFileName.startsWith("\\\\")
  ) {
    throw new DoclingImportError(
      "DOCLING_UNSAFE_FILE_NAME",
      "파일 이름에 경로 순회가 포함되어 있습니다.",
      400,
    );
  }
}

export function assertRoleFileAcceptable(
  role: KnowledgePackFileRole,
  fileName: string,
  clientMime: string | null | undefined,
  bytes: Uint8Array,
): { fileName: string; extension: string; mimeType: string } {
  if (!bytes || bytes.byteLength === 0) {
    throw new DoclingImportError(
      "DOCLING_FILE_REQUIRED",
      "빈 파일은 업로드할 수 없습니다.",
      400,
    );
  }

  const maxBytes = resolveMaxFileBytes();
  if (bytes.byteLength > maxBytes) {
    throw new DoclingImportError(
      "DOCLING_FILE_TOO_LARGE",
      `파일이 최대 크기(${maxBytes} bytes)를 초과했습니다.`,
      413,
    );
  }

  assertNoPathTraversal(fileName);
  const sanitized = sanitizeOriginalFileName(fileName);

  const extension = extensionOfFileName(sanitized);
  if (!extension) {
    throw new DoclingImportError(
      "DOCLING_INVALID_EXTENSION",
      "파일 확장자가 필요합니다.",
      400,
    );
  }
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new DoclingImportError(
      "DOCLING_BLOCKED_EXTENSION",
      "실행 가능하거나 스크립트 확장자는 업로드할 수 없습니다.",
      400,
    );
  }

  let mimeType = (clientMime?.trim() || "").toLowerCase();
  if (!mimeType || mimeType === "application/octet-stream") {
    mimeType = detectMimeFromExtension(extension) ?? mimeType;
  }

  if (role === "SOURCE_ORIGINAL") {
    if (!(DOCLING_SOURCE_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new DoclingImportError(
        "DOCLING_INVALID_SOURCE",
        "원본 파일 확장자가 지원되지 않습니다.",
        400,
      );
    }
    const expected = SOURCE_MIME_BY_EXT[extension];
    if (
      mimeType &&
      expected &&
      mimeType !== expected &&
      mimeType !== "application/octet-stream"
    ) {
      // Allow common aliases; otherwise fall back to extension mime.
      mimeType = expected;
    } else {
      mimeType = mimeType || expected || "application/octet-stream";
    }
  } else if (role === "DOCLING_JSON") {
    if (!(DOCLING_JSON_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new DoclingImportError(
        "DOCLING_INVALID_JSON",
        "Docling JSON은 .json 파일이어야 합니다.",
        400,
      );
    }
    if (mimeType && !JSON_MIME_TYPES.has(mimeType) && mimeType !== "application/octet-stream") {
      throw new DoclingImportError(
        "DOCLING_INVALID_JSON",
        "Docling JSON MIME 유형이 올바르지 않습니다.",
        400,
      );
    }
    mimeType = "application/json";
  } else if (role === "DOCLING_MARKDOWN") {
    if (!(DOCLING_MARKDOWN_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new DoclingImportError(
        "DOCLING_INVALID_MARKDOWN",
        "Docling Markdown은 .md 파일이어야 합니다.",
        400,
      );
    }
    if (
      mimeType &&
      !MARKDOWN_MIME_TYPES.has(mimeType) &&
      mimeType !== "application/octet-stream"
    ) {
      throw new DoclingImportError(
        "DOCLING_INVALID_MARKDOWN",
        "Docling Markdown MIME 유형이 올바르지 않습니다.",
        400,
      );
    }
    mimeType = mimeType === "text/plain" ? "text/plain" : "text/markdown";
  } else {
    throw new DoclingImportError("DOCLING_INVALID_ROLE", "알 수 없는 파일 역할입니다.", 400);
  }

  return { fileName: sanitized, extension, mimeType };
}
