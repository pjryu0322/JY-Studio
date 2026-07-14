import type { KnowledgePackFileRole } from "@prisma/client";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  DOCLING_JSON_EXTENSIONS,
  DOCLING_MARKDOWN_EXTENSIONS,
  DOCLING_SOURCE_EXTENSIONS,
  extensionOfFileName,
} from "@/lib/docling-import/docling-import-file-constants";
import {
  assertFileWithinPolicy,
} from "@/lib/docling-import/docling-upload-policy";
import { validateSourceFileContent } from "@/lib/docling-import/source-file-content-validator";

export {
  DOCLING_JSON_EXTENSIONS,
  DOCLING_MARKDOWN_EXTENSIONS,
  DOCLING_SOURCE_EXTENSIONS,
  extensionOfFileName,
} from "@/lib/docling-import/docling-import-file-constants";

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
  // Keep Unicode letters (Hangul etc.). Strip only path-hostile / control characters.
  // Note: JS \w is ASCII-only and would turn Korean into "_".
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*\\/]/g, "_")
    .slice(0, 180);
  return cleaned || fallback;
}

export function detectMimeFromExtension(extension: string): string | null {
  const ext = extension.toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  return SOURCE_MIME_BY_EXT[ext] ?? null;
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

function assertJsonContent(bytes: Uint8Array): void {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling JSON은 UTF-8 텍스트여야 합니다.",
      400,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling JSON을 파싱할 수 없습니다.",
      400,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling JSON 루트는 객체여야 합니다.",
      400,
    );
  }
}

function assertMarkdownContent(bytes: Uint8Array): void {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling Markdown은 UTF-8 텍스트여야 합니다.",
      400,
    );
  }
  if (!text.trim()) {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling Markdown이 비어 있습니다.",
      400,
    );
  }
  let nul = 0;
  const sample = Math.min(bytes.byteLength, 4096);
  for (let i = 0; i < sample; i++) {
    if (bytes[i] === 0) nul += 1;
  }
  if (nul > 0) {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "Docling Markdown에 허용되지 않은 제어 문자가 포함되어 있습니다.",
      400,
    );
  }
}

export async function assertRoleFileAcceptable(
  role: KnowledgePackFileRole,
  fileName: string,
  clientMime: string | null | undefined,
  bytes: Uint8Array,
): Promise<{ fileName: string; extension: string; mimeType: string }> {
  if (!bytes || bytes.byteLength === 0) {
    throw new DoclingImportError(
      "DOCLING_FILE_REQUIRED",
      "빈 파일은 업로드할 수 없습니다.",
      400,
    );
  }

  // Always use Docling upload policy limits (not ZIP payload limits).
  assertFileWithinPolicy(role, bytes.byteLength);

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
    const content = await validateSourceFileContent({
      extension,
      clientMime,
      bytes,
    });
    mimeType = content.mimeType;
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
    assertJsonContent(bytes);
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
    assertMarkdownContent(bytes);
    mimeType = mimeType === "text/plain" ? "text/plain" : "text/markdown";
  } else {
    throw new DoclingImportError("DOCLING_INVALID_ROLE", "알 수 없는 파일 역할입니다.", 400);
  }

  return { fileName: sanitized, extension, mimeType };
}

/**
 * Metadata-only validation for multipart session creation (no body bytes yet).
 * Content signature / JSON parse run later after objects land in storage.
 */
export function assertRoleFileMetaAcceptable(
  role: KnowledgePackFileRole,
  fileName: string,
  clientMime: string | null | undefined,
  declaredSizeBytes: number,
): { fileName: string; extension: string; mimeType: string } {
  assertFileWithinPolicy(role, declaredSizeBytes);
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
    mimeType =
      detectMimeFromExtension(extension) ??
      (mimeType || "application/octet-stream");
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
