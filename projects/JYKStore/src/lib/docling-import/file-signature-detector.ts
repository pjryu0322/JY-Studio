export type FileSignatureKind =
  | "PDF"
  | "PNG"
  | "JPEG"
  | "TIFF"
  | "ZIP"
  | "HTML"
  | "JSON"
  | "TEXT"
  | "UNKNOWN";

export type FileSignatureDetection = {
  kind: FileSignatureKind;
  confidence: "high" | "medium" | "low";
  mimeType: string | null;
};

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.byteLength < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

function looksLikeUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false;
  let nul = 0;
  const sample = Math.min(bytes.byteLength, 4096);
  for (let i = 0; i < sample; i++) {
    if (bytes[i] === 0) nul += 1;
  }
  if (nul > 2) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, sample));
    const replacement = (text.match(/\uFFFD/g) ?? []).length;
    return replacement / Math.max(text.length, 1) < 0.05;
  } catch {
    return false;
  }
}

function detectHtml(bytes: Uint8Array): boolean {
  if (!looksLikeUtf8Text(bytes)) return false;
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.byteLength, 8192)))
    .toLowerCase();
  return (
    head.includes("<html") ||
    head.includes("<!doctype html") ||
    head.includes("<body") ||
    head.includes("<head")
  );
}

function detectJson(bytes: Uint8Array): boolean {
  if (!looksLikeUtf8Text(bytes)) return false;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect file kind from magic bytes / light content heuristics.
 * Does not fully validate Office OpenXML internals (see office-openxml-validator).
 */
export function detectFileSignature(bytes: Uint8Array): FileSignatureDetection {
  if (!bytes || bytes.byteLength === 0) {
    return { kind: "UNKNOWN", confidence: "low", mimeType: null };
  }

  if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "PDF", confidence: "high", mimeType: "application/pdf" };
  }

  if (
    startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { kind: "PNG", confidence: "high", mimeType: "image/png" };
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "JPEG", confidence: "high", mimeType: "image/jpeg" };
  }

  if (
    startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return { kind: "TIFF", confidence: "high", mimeType: "image/tiff" };
  }

  // ZIP / OOXML container
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return {
      kind: "ZIP",
      confidence: "high",
      mimeType: "application/zip",
    };
  }

  if (detectHtml(bytes)) {
    return { kind: "HTML", confidence: "medium", mimeType: "text/html" };
  }

  if (detectJson(bytes)) {
    return { kind: "JSON", confidence: "medium", mimeType: "application/json" };
  }

  if (looksLikeUtf8Text(bytes)) {
    return { kind: "TEXT", confidence: "low", mimeType: "text/plain" };
  }

  return { kind: "UNKNOWN", confidence: "low", mimeType: null };
}
