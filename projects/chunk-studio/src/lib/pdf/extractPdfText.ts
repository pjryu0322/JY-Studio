export interface PdfExtractResult {
  text: string;
  message: string;
}

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return extractPdfTextFromBytes(bytes, file.name);
}

export async function extractPdfTextFromBytes(
  bytes: Uint8Array,
  fileName = "document.pdf"
): Promise<PdfExtractResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    await configurePdfWorker(pdfjs);
    const worker = new pdfjs.PDFWorker();
    const loadingTask = pdfjs.getDocument({ data: bytes, worker });
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
      text: `PDF 문서 텍스트를 추출하지 못했습니다. 파일명: ${fileName}`,
      message: "PDF processed, but text extraction returned empty content.",
    };
  } catch (error) {
    return {
      text: `PDF extraction failed. Fallback content generated for ${fileName}.`,
      message:
        error instanceof Error
          ? `PDF extraction failed: ${error.message}`
          : "PDF extraction failed.",
    };
  }
}

async function configurePdfWorker(
  pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs")
): Promise<void> {
  try {
    // Keep worker source as a package specifier so Next.js server bundling can resolve it.
    pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
  } catch {
    // Keep default worker resolution; extraction will still surface a clear error.
  }
}
