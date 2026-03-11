"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfPreviewClientProps {
  fileUrl: string;
  width: number;
  onFirstPageSize?: (size: { width: number; height: number }) => void;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: () => void;
}

export default function PdfPreviewClient({
  fileUrl,
  width,
  onFirstPageSize,
  onLoadSuccess,
  onLoadError,
}: PdfPreviewClientProps) {
  const [numPages, setNumPages] = useState(0);

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
            <Page
              pageNumber={idx + 1}
              width={width}
              onLoadSuccess={(page) => {
                if (idx === 0) {
                  const viewport = page.getViewport({ scale: 1 });
                  onFirstPageSize?.({ width: viewport.width, height: viewport.height });
                }
              }}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}

