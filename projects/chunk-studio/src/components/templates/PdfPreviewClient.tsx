"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfPreviewClientProps {
  fileUrl: string;
  width: number;
  onFirstPageSize?: (size: { width: number; height: number }) => void;
  renderOverlay?: (pageNumber: number, size: { width: number; height: number }) => ReactNode;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: () => void;
}

export default function PdfPreviewClient({
  fileUrl,
  width,
  onFirstPageSize,
  renderOverlay,
  onLoadSuccess,
  onLoadError,
}: PdfPreviewClientProps) {
  const [numPages, setNumPages] = useState(0);
  const [firstPageRatio, setFirstPageRatio] = useState<number | null>(null);
  const pageHeight = useMemo(() => {
    if (!firstPageRatio || width <= 0) return 0;
    return Math.max(1, Math.floor(width * firstPageRatio));
  }, [firstPageRatio, width]);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <Document
        file={fileUrl}
        onLoadSuccess={(result) => {
          setNumPages(result.numPages);
          onLoadSuccess?.(result.numPages);
        }}
        onLoadError={() => onLoadError?.()}
      >
        {Array.from({ length: numPages }, (_, idx) => (
          <div
            key={`pdf-page-${idx + 1}`}
            data-page-number={idx + 1}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
              maxWidth: "100%",
            }}
          >
            <div style={{ position: "relative", width, maxWidth: "100%", minHeight: pageHeight || undefined }}>
              <Page
                pageNumber={idx + 1}
                width={width}
                onLoadSuccess={(page) => {
                  if (idx === 0) {
                    const viewport = page.getViewport({ scale: 1 });
                    onFirstPageSize?.({ width: viewport.width, height: viewport.height });
                    setFirstPageRatio(viewport.height / viewport.width);
                  }
                }}
              />
              {pageHeight > 0 && renderOverlay?.(idx + 1, { width, height: pageHeight })}
            </div>
          </div>
        ))}
      </Document>
    </div>
  );
}

