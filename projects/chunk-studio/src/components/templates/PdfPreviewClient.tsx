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
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: () => void;
}

export default function PdfPreviewClient({
  fileUrl,
  width,
  onLoadSuccess,
  onLoadError,
}: PdfPreviewClientProps) {
  const [numPages, setNumPages] = useState(0);

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={(result) => {
        setNumPages(result.numPages);
        onLoadSuccess?.(result.numPages);
      }}
      onLoadError={() => onLoadError?.()}
    >
      {Array.from({ length: numPages }, (_, idx) => (
        <div key={`pdf-page-${idx + 1}`} data-page-number={idx + 1}>
          <Page pageNumber={idx + 1} width={width} />
        </div>
      ))}
    </Document>
  );
}

