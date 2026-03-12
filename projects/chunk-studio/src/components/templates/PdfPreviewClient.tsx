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
  onPageTextMap?: (
    pageNumber: number,
    blocks: Array<{ text: string; x: number; y: number; width: number; height: number; page: number }>
  ) => void;
}

export default function PdfPreviewClient({
  fileUrl,
  width,
  onFirstPageSize,
  renderOverlay,
  onLoadSuccess,
  onLoadError,
  onPageTextMap,
}: PdfPreviewClientProps) {
  const [numPages, setNumPages] = useState(0);
  const [firstPageRatio, setFirstPageRatio] = useState<number | null>(null);
  const pageRoots = useMemo(() => new Map<number, HTMLDivElement>(), []);
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
              width,
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <div
              ref={(el) => {
                if (!el) {
                  pageRoots.delete(idx + 1);
                  return;
                }
                pageRoots.set(idx + 1, el);
              }}
              style={{ position: "relative", width, minHeight: pageHeight || undefined }}
            >
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
                onRenderTextLayerSuccess={() => {
                  if (!onPageTextMap) return;
                  const pageRoot = pageRoots.get(idx + 1);
                  if (!pageRoot) return;
                  const textLayer = pageRoot.querySelector(".react-pdf__Page__textContent");
                  if (!textLayer) return;
                  const rootRect = pageRoot.getBoundingClientRect();
                  const spans = Array.from(textLayer.querySelectorAll("span")) as HTMLSpanElement[];
                  const blocks = spans
                    .map((span) => {
                      const text = span.textContent?.trim() ?? "";
                      if (!text) return null;
                      const rect = span.getBoundingClientRect();
                      return {
                        text,
                        x: rect.left - rootRect.left,
                        y: rect.top - rootRect.top,
                        width: rect.width,
                        height: rect.height,
                        page: idx + 1,
                      };
                    })
                    .filter(
                      (
                        entry
                      ): entry is {
                        text: string;
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                        page: number;
                      } => Boolean(entry)
                    );
                  onPageTextMap(idx + 1, blocks);
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

