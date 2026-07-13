import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { detectFileSignature } from "@/lib/docling-import/file-signature-detector";
import { assertOfficeOpenXmlPackage } from "@/lib/docling-import/office-openxml-validator";

const EXT_TO_KIND: Record<string, string> = {
  ".pdf": "PDF",
  ".png": "PNG",
  ".jpg": "JPEG",
  ".jpeg": "JPEG",
  ".tiff": "TIFF",
  ".tif": "TIFF",
  ".html": "HTML",
  ".htm": "HTML",
  ".docx": "DOCX",
  ".pptx": "PPTX",
  ".xlsx": "XLSX",
};

const KIND_MIME: Record<string, string> = {
  PDF: "application/pdf",
  PNG: "image/png",
  JPEG: "image/jpeg",
  TIFF: "image/tiff",
  HTML: "text/html",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const ACCEPTABLE_CLIENT_MIME_ALIASES: Record<string, Set<string>> = {
  PDF: new Set(["application/pdf"]),
  PNG: new Set(["image/png"]),
  JPEG: new Set(["image/jpeg", "image/jpg"]),
  TIFF: new Set(["image/tiff", "image/tif"]),
  HTML: new Set(["text/html", "application/xhtml+xml"]),
  DOCX: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ]),
  PPTX: new Set([
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ]),
  XLSX: new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ]),
};

function assertHtmlContent(bytes: Uint8Array): void {
  const sampleLen = Math.min(bytes.byteLength, 8192);
  let nul = 0;
  for (let i = 0; i < sampleLen; i++) {
    if (bytes[i] === 0) nul += 1;
  }
  if (nul > 2) {
    throw new DoclingImportError(
      "DOCLING_HTML_CONTENT_INVALID",
      "HTML 원본문서에 이진/NUL 바이트가 과도하게 포함되어 있습니다.",
      400,
    );
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, sampleLen));
  const lower = text.toLowerCase();
  const hasMarker =
    lower.includes("<html") ||
    lower.includes("<!doctype html") ||
    lower.includes("<body") ||
    lower.includes("<head");
  if (!hasMarker) {
    throw new DoclingImportError(
      "DOCLING_HTML_CONTENT_INVALID",
      "HTML 원본문서 형식이 올바르지 않습니다.",
      400,
    );
  }
}

/**
 * Cross-check extension + client MIME + byte signature for SOURCE_ORIGINAL.
 * Returns the MIME to store (from detected type). Never silently overwrites on mismatch.
 */
export async function validateSourceFileContent(input: {
  extension: string;
  clientMime: string | null | undefined;
  bytes: Uint8Array;
}): Promise<{ mimeType: string }> {
  const ext = input.extension.toLowerCase();
  const expectedKind = EXT_TO_KIND[ext];
  if (!expectedKind) {
    throw new DoclingImportError(
      "DOCLING_INVALID_SOURCE",
      "원본 파일 확장자가 지원되지 않습니다.",
      400,
    );
  }

  const detection = detectFileSignature(input.bytes);
  const clientMime = (input.clientMime?.trim() || "").toLowerCase();

  if (expectedKind === "DOCX" || expectedKind === "PPTX" || expectedKind === "XLSX") {
    if (detection.kind !== "ZIP") {
      throw new DoclingImportError(
        "DOCLING_FILE_SIGNATURE_MISMATCH",
        "파일 확장자와 실제 파일 형식이 일치하지 않습니다. Docling 원본문서를 다시 확인하세요.",
        400,
      );
    }
    await assertOfficeOpenXmlPackage(input.bytes, expectedKind);
  } else if (expectedKind === "HTML") {
    if (detection.kind !== "HTML" && detection.kind !== "TEXT") {
      throw new DoclingImportError(
        "DOCLING_FILE_SIGNATURE_MISMATCH",
        "파일 확장자와 실제 파일 형식이 일치하지 않습니다. Docling 원본문서를 다시 확인하세요.",
        400,
      );
    }
    assertHtmlContent(input.bytes);
  } else {
    if (detection.kind !== expectedKind) {
      throw new DoclingImportError(
        "DOCLING_FILE_SIGNATURE_MISMATCH",
        "파일 확장자와 실제 파일 형식이 일치하지 않습니다. Docling 원본문서를 다시 확인하세요.",
        400,
      );
    }
  }

  if (
    clientMime &&
    clientMime !== "application/octet-stream" &&
    !(ACCEPTABLE_CLIENT_MIME_ALIASES[expectedKind]?.has(clientMime))
  ) {
    throw new DoclingImportError(
      "DOCLING_MIME_MISMATCH",
      "클라이언트 MIME 유형과 실제 파일 형식이 일치하지 않습니다.",
      400,
    );
  }

  const mimeType = KIND_MIME[expectedKind];
  if (!mimeType) {
    throw new DoclingImportError(
      "DOCLING_FILE_CONTENT_INVALID",
      "원본 파일 내용을 확인할 수 없습니다.",
      400,
    );
  }

  return { mimeType };
}
