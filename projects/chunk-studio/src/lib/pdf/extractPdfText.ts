export interface PdfExtractResult {
  text: string;
  message: string;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? String(item.str ?? "") : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(pageText);
    }
    const text = pages.join("\n\n").trim();
    if (text) {
      return {
        text,
        message: `PDF extracted (${doc.numPages}p).`,
      };
    }
    return {
      text: `PDF 문서 텍스트를 추출하지 못했습니다. 파일명: ${file.name}`,
      message: "PDF processed, but text extraction returned empty content.",
    };
  } catch (error) {
    return {
      text: `PDF extraction failed. Fallback content generated for ${file.name}.`,
      message:
        error instanceof Error
          ? `PDF extraction failed: ${error.message}`
          : "PDF extraction failed.",
    };
  }
}
