/**
 * DOC/DOCX direct text extraction fallback (without LibreOffice conversion).
 * - DOCX: use mammoth raw text extraction from buffer.
 * - DOC: binary .doc is not reliably supported here; return empty text with message.
 */

export interface DocExtractResult {
  text: string;
  message: string;
}

export async function extractDocText(
  file: File,
  ext: string
): Promise<DocExtractResult> {
  if (ext === "doc") {
    return {
      text: "",
      message:
        "DOC direct extraction is limited. Uploaded without PDF conversion; extracted text may be empty.",
    };
  }

  try {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? "").trim();
    return {
      text,
      message:
        text.length > 0
          ? "DOCX processed directly without PDF conversion."
          : "DOCX processed directly, but extracted text is empty.",
    };
  } catch (error) {
    return {
      text: "",
      message:
        error instanceof Error
          ? `DOCX direct extraction failed: ${error.message}`
          : "DOCX direct extraction failed.",
    };
  }
}

