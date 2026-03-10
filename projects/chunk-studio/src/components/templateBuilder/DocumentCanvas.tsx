"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import SelectionOverlay from "./SelectionOverlay";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

interface BBox {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DraftBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DocumentCanvasProps {
  pdfUrl: string;
  fallbackText?: string;
  sectionBoxes: BBox[];
  otherBoxes: BBox[];
  focusedBoxId?: string | null;
  onSelectionComplete: (bbox: DraftBox, at: { x: number; y: number }) => void;
}

interface Frame {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export default function DocumentCanvas({
  pdfUrl,
  fallbackText,
  sectionBoxes,
  otherBoxes,
  focusedBoxId,
  onSelectionComplete,
}: DocumentCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const [start, setStart] = useState<{ page: number; x: number; y: number } | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [pageFrames, setPageFrames] = useState<Frame[]>([]);

  useEffect(() => {
    const updateFrame = () => {
      const root = canvasRef.current;
      if (!root || pdfError) return;
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width <= 0 || rootRect.height <= 0) return;
      const pageNodes = Array.from(
        root.querySelectorAll("[data-page-number] .react-pdf__Page")
      ) as HTMLElement[];
      if (pageNodes.length === 0) return;
      const nextFrames = pageNodes
        .map((node) => {
          const wrapper = node.closest("[data-page-number]") as HTMLElement | null;
          const page = Number(wrapper?.dataset.pageNumber ?? "0");
          if (!wrapper || !page) return null;
          const rect = node.getBoundingClientRect();
          return {
            page,
            x: clamp01((rect.left - rootRect.left) / rootRect.width),
            y: clamp01((rect.top - rootRect.top) / rootRect.height),
            w: clamp01(rect.width / rootRect.width),
            h: clamp01(rect.height / rootRect.height),
          };
        })
        .filter((v): v is Frame => Boolean(v))
        .sort((a, b) => a.page - b.page);
      setPageFrames(nextFrames);
    };

    const root = canvasRef.current;
    if (!root) return;
    const obs = new ResizeObserver(() => updateFrame());
    obs.observe(root);
    const timer = window.setInterval(updateFrame, 300);
    updateFrame();
    return () => {
      obs.disconnect();
      window.clearInterval(timer);
    };
  }, [pdfError]);

  const frameByPage = useMemo(
    () => new Map(pageFrames.map((f) => [f.page, f])),
    [pageFrames]
  );

  const mapToCanvasBox = (box: BBox): BBox | null => {
    const frame = frameByPage.get(box.page);
    if (!frame) return null;
    return {
    id: box.id,
    page: box.page,
    x: frame.x + box.x * frame.w,
    y: frame.y + box.y * frame.h,
    w: box.w * frame.w,
    h: box.h * frame.h,
    };
  };

  const mappedSectionBoxes = sectionBoxes
    .map((b) => mapToCanvasBox(b))
    .filter((v): v is BBox => Boolean(v));
  const mappedOtherBoxes = otherBoxes
    .map((b) => mapToCanvasBox(b))
    .filter((v): v is BBox => Boolean(v));
  const mappedDraft = draft
    ? mapToCanvasBox({
        id: "__draft__",
        page: draft.page,
        x: draft.x,
        y: draft.y,
        w: draft.w,
        h: draft.h,
      })
    : null;

  useEffect(() => {
    if (!focusedBoxId || !canvasRef.current) return;
    const target = [...sectionBoxes, ...otherBoxes].find(
      (b) => b.id === focusedBoxId
    );
    if (!target) return;
    const frame = frameByPage.get(target.page);
    if (!frame) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const targetTop = rect.top + (frame.y + target.y * frame.h) * rect.height;
    const targetHeight = target.h * frame.h * rect.height;

    const parent = canvasRef.current.parentElement;
    if (parent && parent.scrollHeight > parent.clientHeight) {
      const parentRect = parent.getBoundingClientRect();
      const inParentTop = targetTop - parentRect.top + parent.scrollTop;
      parent.scrollTo({
        top: Math.max(0, inParentTop - parent.clientHeight * 0.25 + targetHeight * 0.5),
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: Math.max(0, window.scrollY + targetTop - window.innerHeight * 0.28),
        behavior: "smooth",
      });
    }
  }, [focusedBoxId, sectionBoxes, otherBoxes, frameByPage]);

  return (
    <div
      ref={canvasRef}
      style={{
        position: "relative",
        border: "1px solid #d2d2d2",
        borderRadius: 8,
        minHeight: 720,
        overflow: "hidden",
        background: "#f9f9f9",
      }}
      onMouseDown={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const frame = pageFrames.find(
          (f) => px >= f.x && py >= f.y && px <= f.x + f.w && py <= f.y + f.h
        );
        if (!frame) return;
        const x = clamp01((px - frame.x) / Math.max(frame.w, 1e-6));
        const y = clamp01((py - frame.y) / Math.max(frame.h, 1e-6));
        setStart({ page: frame.page, x, y });
        setDraft({ page: frame.page, x, y, w: 0, h: 0 });
      }}
      onMouseMove={(e) => {
        if (!start) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const frame = frameByPage.get(start.page);
        if (!frame) return;
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const nx = clamp01((px - frame.x) / Math.max(frame.w, 1e-6));
        const ny = clamp01((py - frame.y) / Math.max(frame.h, 1e-6));
        const x = Math.min(nx, start.x);
        const y = Math.min(ny, start.y);
        const w = Math.abs(nx - start.x);
        const h = Math.abs(ny - start.y);
        setDraft({ page: start.page, x, y, w, h });
      }}
      onMouseUp={(e) => {
        setStart(null);
        if (!draft || draft.w < 0.01 || draft.h < 0.01) return;
        onSelectionComplete(draft, { x: e.clientX + 8, y: e.clientY + 8 });
        setDraft(null);
      }}
      onMouseLeave={() => {
        setStart(null);
        setDraft(null);
      }}
    >
      {!pdfError && (
        <PdfPreviewClient
          fileUrl={pdfUrl}
          width={760}
          onLoadError={() => setPdfError(true)}
        />
      )}
      {pdfError && (
        <div style={{ padding: 12, fontSize: 12, color: "#444", whiteSpace: "pre-wrap" }}>
          {fallbackText?.slice(0, 4000) ||
            "PDF 미리보기를 로드하지 못했습니다. 텍스트 fallback 상태에서 영역 선택은 계속 가능합니다."}
        </div>
      )}

      <SelectionOverlay
        sections={mappedSectionBoxes}
        others={mappedOtherBoxes}
        draft={mappedDraft}
        focusedId={focusedBoxId}
      />
    </div>
  );
}

