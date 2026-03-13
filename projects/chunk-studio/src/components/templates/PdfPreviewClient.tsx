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
  viewMode?: "continuous" | "single";
  focusedPage?: number;
  onFirstPageSize?: (size: { width: number; height: number }) => void;
  onPageSize?: (pageNumber: number, size: { width: number; height: number }) => void;
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
  viewMode = "continuous",
  focusedPage = 1,
  onFirstPageSize,
  onPageSize,
  renderOverlay,
  onLoadSuccess,
  onLoadError,
  onPageTextMap,
}: PdfPreviewClientProps) {
  const [numPages, setNumPages] = useState(0);
  const [firstPageRatio, setFirstPageRatio] = useState<number | null>(null);
  const [pageRatios, setPageRatios] = useState<Record<number, number>>({});
  const pageRoots = useMemo(() => new Map<number, HTMLDivElement>(), []);

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
        {(viewMode === "single"
          ? [Math.min(Math.max(1, focusedPage), Math.max(1, numPages))]
          : Array.from({ length: numPages }, (_, idx) => idx + 1)
        ).map((pageNumber) => {
          const idx = pageNumber - 1;
          return (
          <div
            key={`pdf-page-${pageNumber}`}
            data-page-number={pageNumber}
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
                  pageRoots.delete(pageNumber);
                  return;
                }
                pageRoots.set(pageNumber, el);
              }}
              style={{
                position: "relative",
                width,
                minHeight: (() => {
                  const ratio = pageRatios[pageNumber] ?? firstPageRatio;
                  if (!ratio || ratio <= 0) return undefined;
                  return Math.max(1, Math.floor(width * ratio));
                })(),
              }}
            >
              <Page
                pageNumber={pageNumber}
                width={width}
                onLoadSuccess={(page) => {
                  const viewport = page.getViewport({ scale: 1 });
                  const ratio = viewport.height / Math.max(1, viewport.width);
                  setPageRatios((prev) => ({ ...prev, [pageNumber]: ratio }));
                  onPageSize?.(pageNumber, { width: viewport.width, height: viewport.height });
                  if (idx === 0 || firstPageRatio == null) {
                    onFirstPageSize?.({ width: viewport.width, height: viewport.height });
                    setFirstPageRatio(ratio);
                  }
                }}
                onRenderTextLayerSuccess={() => {
                  if (!onPageTextMap) return;
                  const pageRoot = pageRoots.get(pageNumber);
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
                        page: pageNumber,
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
                  onPageTextMap(pageNumber, blocks);
                }}
              />
              {(() => {
                const ratio = pageRatios[pageNumber] ?? firstPageRatio;
                if (!ratio || ratio <= 0) return null;
                const pageHeight = Math.max(1, Math.floor(width * ratio));
                return renderOverlay?.(pageNumber, { width, height: pageHeight });
              })()}
            </div>
          </div>
          );
        })}
      </Document>
    </div>
  );
}

