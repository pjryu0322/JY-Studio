"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import ChunkOverlayLayer from "./ChunkOverlayLayer";
import {
  classifyPageType,
  type ClassifiedPageResult,
  type PageLayoutProfile,
  type PageTypeScores,
  type PageTextBlock,
  type PageType,
} from "./pageTypeClassifier";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

type PdfViewMode = "continuous" | "single";

interface PdfFirstPageSize {
  width: number;
  height: number;
}

type PageOrientation = "portrait" | "landscape";

interface PageProfile {
  pageNumber: number;
  width: number;
  height: number;
  orientation: PageOrientation;
  pageType: PageType;
  confidence: number;
}

interface PdfSemanticChunkEditorProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onReload: () => Promise<void>;
}

export default function PdfSemanticChunkEditor({
  selectedJob,
  detail,
  loading,
  error,
  onUpload,
  onReload,
}: PdfSemanticChunkEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfViewMode, setPdfViewMode] = useState<PdfViewMode>("single");
  const [freezeCurrentPage, setFreezeCurrentPage] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [firstPageSize, setFirstPageSize] = useState<PdfFirstPageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [hoverChunkId, setHoverChunkId] = useState<string | null>(null);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rechunking, setRechunking] = useState(false);
  const [fallbackActionError, setFallbackActionError] = useState<string | null>(null);
  const [boundaryRatiosByPage, setBoundaryRatiosByPage] = useState<Record<number, number[]>>({});
  const [pageTextMapByPage, setPageTextMapByPage] = useState<Record<number, PageTextBlock[]>>({});
  const [pageSizeByPage, setPageSizeByPage] = useState<Record<number, { width: number; height: number }>>({});
  const [pageTypeByPage, setPageTypeByPage] = useState<Record<number, PageType>>({});
  const [pageProfileByPage, setPageProfileByPage] = useState<Record<number, PageLayoutProfile>>({});
  const [pageScoresByPage, setPageScoresByPage] = useState<Record<number, PageTypeScores>>({});
  const [pageTypeOverrideByPage, setPageTypeOverrideByPage] = useState<Record<number, PageType | null>>(
    {}
  );
  const [toolbarAnchor, setToolbarAnchor] = useState<{ x: number; y: number } | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAnalyzerPage, setHoveredAnalyzerPage] = useState<number | null>(null);
  const [overlaySelectionByPage, setOverlaySelectionByPage] = useState<Record<number, boolean>>({});
  const [appliedOverlayPages, setAppliedOverlayPages] = useState<Set<number>>(new Set());
  const [mergeMenuOpen, setMergeMenuOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<string>>(new Set());
  const [mergePairs, setMergePairs] = useState<Record<string, string>>({});
  const [modifiedChunkIds, setModifiedChunkIds] = useState<Set<string>>(new Set());
  const [splitCursorOffset, setSplitCursorOffset] = useState<number | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anchorCacheRef = useRef<Record<string, { top: number; bottom: number; left: number; right: number }>>({});
  const wheelSwitchAtRef = useRef(0);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const selectedJobId = selectedJob?.id ?? null;
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const chunks = useMemo(() => detail?.chunks ?? [], [detail?.chunks]);
  const selectedChunk = useMemo(
    () => chunks.find((chunk) => chunk.meta.chunkId === selectedChunkId) ?? null,
    [chunks, selectedChunkId]
  );
  const hoverChunk = useMemo(
    () => chunks.find((chunk) => chunk.meta.chunkId === hoverChunkId) ?? null,
    [chunks, hoverChunkId]
  );
  const selectedChunkQuality = selectedChunk ? qualityLabel(selectedChunk) : null;
  const selectedChunkIndex = useMemo(() => {
    if (!selectedChunk) return -1;
    return chunks.findIndex((chunk) => chunk.meta.chunkId === selectedChunk.meta.chunkId);
  }, [chunks, selectedChunk]);
  const selectedChunkText = useMemo(() => {
    if (!selectedChunk) return "";
    return selectedChunk.text
      .split("\n")
      .filter(
        (line) =>
          !line.toLowerCase().includes("pdf extraction failed") &&
          !line.toLowerCase().includes("fallback content generated")
      )
      .join("\n")
      .trim();
  }, [selectedChunk]);
  const selectedChunkPreview = useMemo(
    () => buildPreviewSnippet(selectedChunkText, 4),
    [selectedChunkText]
  );
  const hoverChunkPreview = useMemo(
    () => (hoverChunk ? buildPreviewSnippet(hoverChunk.text, 3) : ""),
    [hoverChunk]
  );
  const qualityInsight = useMemo(
    () => (selectedChunk ? buildQualityInsight(selectedChunk, chunks, selectedChunkIndex) : null),
    [chunks, selectedChunk, selectedChunkIndex]
  );
  const toolbarPosition = useMemo(() => {
    const defaultPos = { top: 56, left: 16 };
    if (!toolbarAnchor || typeof window === "undefined") return defaultPos;
    const width = 420;
    const left = clamp(toolbarAnchor.x - width / 2, 12, window.innerWidth - width - 12);
    const top = clamp(toolbarAnchor.y - 46, 12, window.innerHeight - 120);
    return { top, left };
  }, [toolbarAnchor]);
  const hasFallbackChunk = useMemo(() => {
    if (!detail) return false;
    const message = (detail.message ?? "").toLowerCase();
    if (message.includes("pdf extraction failed")) return true;
    return chunks.some((chunk) => {
      const text = chunk.text.toLowerCase();
      return (
        text.includes("pdf extraction failed") ||
        text.includes("fallback content generated")
      );
    });
  }, [chunks, detail]);
  const currentPageProfile = pageProfileByPage[currentPage] ?? null;
  const currentPageScores = pageScoresByPage[currentPage] ?? null;
  const selectedChunkAnchors = useMemo(() => {
    if (!selectedChunk) return null;
    const pageRange = (selectedChunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
    const preferredPage = Array.isArray(pageRange) && pageRange.length === 2 ? pageRange[0] : 1;
    const blocks = pageTextMapByPage[preferredPage] ?? [];
    if (blocks.length === 0) return null;
    const resolved = resolveChunkAnchor(selectedChunk, blocks, anchorCacheRef.current);
    if (!resolved) return null;
    return { page: preferredPage, ...resolved };
  }, [pageTextMapByPage, selectedChunk]);
  const selectedTextBlocks = useMemo(() => {
    if (!selectedChunkAnchors || !selectedChunk) return [] as Array<{ x: number; y: number; width: number; height: number }>;
    const blocks = pageTextMapByPage[selectedChunkAnchors.page] ?? [];
    if (blocks.length === 0) return [];
    return blocks
      .filter((block) => intersects(block, selectedChunkAnchors))
      .slice(0, 30)
      .map((block) => ({ x: block.x, y: block.y, width: block.width, height: block.height }));
  }, [pageTextMapByPage, selectedChunk, selectedChunkAnchors]);
  const renderWidth = useMemo(() => {
    const fallback = 420;
    if (!firstPageSize) return fallback;
    const pageSize =
      pdfViewMode === "single" ? pageSizeByPage[currentPage] ?? firstPageSize : firstPageSize;
    const pageWidth = Math.max(1, pageSize.width);
    return Math.max(120, Math.floor(pageWidth * zoom));
  }, [currentPage, firstPageSize, pageSizeByPage, pdfViewMode, zoom]);
  const zoomPercentLabel = useMemo(() => {
    return `${Math.round(zoom * 100)}%`;
  }, [zoom]);
  const pageProfiles = useMemo(() => {
    if (!numPages) return [] as PageProfile[];
    const items: PageProfile[] = [];
    for (let page = 1; page <= numPages; page += 1) {
      const size = pageSizeByPage[page];
      const scores = pageScoresByPage[page];
      const detectedType = pageTypeOverrideByPage[page] ?? pageTypeByPage[page] ?? "body";
      const width = size?.width ?? firstPageSize?.width ?? 0;
      const height = size?.height ?? firstPageSize?.height ?? 0;
      const orientation: PageOrientation = width > height ? "landscape" : "portrait";
      items.push({
        pageNumber: page,
        width,
        height,
        orientation,
        pageType: detectedType,
        confidence: estimateConfidence(scores),
      });
    }
    return items;
  }, [firstPageSize, numPages, pageScoresByPage, pageSizeByPage, pageTypeByPage, pageTypeOverrideByPage]);
  const selectedOverlayCount = useMemo(
    () => Object.values(overlaySelectionByPage).filter(Boolean).length,
    [overlaySelectionByPage]
  );

  useEffect(() => {
    setMergeMenuOpen(false);
    setAiSuggestion(null);
    if (selectedChunkId) {
      setInspectorOpen(true);
      setInspectorExpanded(false);
    }
  }, [selectedChunkId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!inspectorOpen) return;
      setInspectorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectorOpen]);

  useEffect(() => {
    if (!selectedChunkId || !selectedChunkAnchors) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    const pageEl = viewport.querySelector(
      `[data-page-number="${selectedChunkAnchors.page}"]`
    ) as HTMLDivElement | null;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const targetTop = pageRect.top - viewportRect.top + viewport.scrollTop + selectedChunkAnchors.top;
    const centered = Math.max(0, targetTop - viewport.clientHeight * 0.35);
    viewport.scrollTo({ top: centered, behavior: "smooth" });
  }, [selectedChunkAnchors, selectedChunkId]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTop = 0;
    setCurrentPage(1);
    setZoom(1);
    setPageTextMapByPage({});
    setPageSizeByPage({});
    setPageTypeByPage({});
    setPageProfileByPage({});
    setPageScoresByPage({});
    setPageTypeOverrideByPage({});
    setOverlaySelectionByPage({});
    setAppliedOverlayPages(new Set());
    anchorCacheRef.current = {};
  }, [selectedJobId]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const onScroll = () => {
      if (freezeCurrentPage) return;
      const pages = Array.from(
        viewport.querySelectorAll("[data-page-number]")
      ) as Array<HTMLElement>;
      if (pages.length === 0) return;
      const viewportTop = viewport.getBoundingClientRect().top;
      let nearestPage = 1;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const page of pages) {
        const value = Number(page.getAttribute("data-page-number") ?? "0");
        if (!value) continue;
        const dist = Math.abs(page.getBoundingClientRect().top - viewportTop);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPage = value;
        }
      }
      setCurrentPage(nearestPage);
    };
    viewport.addEventListener("scroll", onScroll);
    onScroll();
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [freezeCurrentPage, selectedJobId, numPages]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const update = () => {
      setViewportSize({
        width: Math.max(0, viewport.clientWidth),
        height: Math.max(0, viewport.clientHeight),
      });
    };
    const obs = new ResizeObserver(update);
    obs.observe(viewport);
    update();
    return () => obs.disconnect();
  }, []);

  const handleViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 4) return;
    const now = Date.now();
    if (now - wheelSwitchAtRef.current < 130) {
      event.preventDefault();
      return;
    }
    wheelSwitchAtRef.current = now;
    event.preventDefault();
    setCurrentPage((prev) => {
      const next = event.deltaY > 0 ? prev + 1 : prev - 1;
      return clamp(next, 1, Math.max(1, numPages));
    });
  };

  useEffect(() => {
    let cancelled = false;
    setPdfAvailabilityChecked(false);
    if (!selectedJobId || !canPreviewPdf) {
      setPdfAvailabilityChecked(true);
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`/api/jobs/${selectedJobId}/pdf`, { method: "HEAD" });
        if (cancelled) return;
        if (res.ok) {
          setFailedPdfJobId(null);
          setPreviewFailureReason(null);
        } else {
          setFailedPdfJobId(selectedJobId);
          setPreviewFailureReason(
            res.status === 404 ? "원본 PDF 파일을 찾을 수 없습니다." : "원본 PDF 렌더링에 실패했습니다."
          );
        }
      } catch {
        if (cancelled) return;
        setFailedPdfJobId(selectedJobId);
        setPreviewFailureReason("파일 형식 또는 렌더러 상태를 확인해 주세요.");
      } finally {
        if (!cancelled) setPdfAvailabilityChecked(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [canPreviewPdf, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) return;
    window.dispatchEvent(
      new CustomEvent("chunkstudio:refinements-changed", {
        detail: {
          jobId: selectedJob.id,
          editedLabels,
          reviewNotes,
          excludedChunkIds: Array.from(excludedChunkIds),
          mergePairs,
          modifiedChunkIds: Array.from(modifiedChunkIds),
        },
      })
    );
  }, [editedLabels, excludedChunkIds, mergePairs, modifiedChunkIds, reviewNotes, selectedJob]);

  const handleExport = async () => {
    if (!selectedJob) return;
    try {
      setExportError(null);
      const res = await fetch("/api/export/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id, format: "jsonl" }),
      });
      if (!res.ok) {
        setExportError("Export에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rag_dataset_${selectedJob.id}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export 중 오류가 발생했습니다.");
    }
  };

  const selectChunk = (chunk: ChunkDTO) => {
    setSelectedChunkId(chunk.meta.chunkId);
    setInspectorOpen(true);
    window.dispatchEvent(new CustomEvent("chunkstudio:selected-chunk", { detail: chunk.meta.chunkId }));
  };

  const mergeWith = (direction: "prev" | "next") => {
    if (!selectedChunk || selectedChunkIndex < 0) return;
    const target =
      direction === "prev" ? chunks[selectedChunkIndex - 1] ?? null : chunks[selectedChunkIndex + 1] ?? null;
    if (!target) return;
    setMergePairs((prev) => ({
      ...prev,
      [selectedChunk.meta.chunkId]: target.meta.chunkId,
    }));
    setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId).add(target.meta.chunkId));
    setMergeMenuOpen(false);
  };

  const splitSelectedChunk = () => {
    if (!selectedChunk) return;
    const offset = splitCursorOffset ?? Math.floor(selectedChunk.text.length / 2);
    setReviewNotes((prev) => ({
      ...prev,
      [selectedChunk.meta.chunkId]:
        (prev[selectedChunk.meta.chunkId] ?? "") + `\n[split] offset ${offset}`,
    }));
    setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId));
  };

  const toggleExcludeSelectedChunk = () => {
    if (!selectedChunk) return;
    setExcludedChunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedChunk.meta.chunkId)) next.delete(selectedChunk.meta.chunkId);
      else next.add(selectedChunk.meta.chunkId);
      return next;
    });
    setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId));
  };

  const triggerAiSuggestion = () => {
    if (!selectedChunk) return;
    setAiSuggestion(buildAiSuggestion(selectedChunk, chunks, selectedChunkIndex));
  };

  const handleRechunk = async () => {
    if (!selectedJobId) return;
    try {
      setRechunking(true);
      setFallbackActionError(null);
      const res = await fetch(`/api/jobs/${selectedJobId}/rechunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setFallbackActionError(payload.error ?? "재청킹에 실패했습니다.");
        return;
      }
      await onReload();
    } catch {
      setFallbackActionError("재청킹 중 오류가 발생했습니다.");
    } finally {
      setRechunking(false);
    }
  };

  const scrollToPage = (pageNumber: number) => {
    if (pdfViewMode === "single") {
      setCurrentPage(pageNumber);
      return;
    }
    const viewport = scrollRef.current;
    if (!viewport) return;
    const pageEl = viewport.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLElement | null;
    if (!pageEl) return;
    const targetTop = Math.max(0, pageEl.offsetTop - 8);
    viewport.scrollTo({ top: targetTop, behavior: "smooth" });
    setCurrentPage(pageNumber);
  };
  const selectAllOverlayPages = () => {
    if (!numPages) return;
    const next: Record<number, boolean> = {};
    for (let page = 1; page <= numPages; page += 1) next[page] = true;
    setOverlaySelectionByPage(next);
    setAppliedOverlayPages(new Set(Array.from({ length: numPages }, (_, idx) => idx + 1)));
  };
  const clearOverlaySelection = () => {
    setOverlaySelectionByPage({});
    setAppliedOverlayPages(new Set());
  };
  const nudgeZoom = (delta: number) => {
    const pageSize =
      pdfViewMode === "single" ? pageSizeByPage[currentPage] ?? firstPageSize : firstPageSize;
    const basePageWidth = Math.max(1, pageSize?.width ?? firstPageSize?.width ?? 1);
    const currentScale = renderWidth / basePageWidth;
    const nextScale = clamp(Number((currentScale + delta).toFixed(2)), 0.2, 3);
    setZoom(nextScale);
  };

  if (!selectedJob || !canPreviewPdf) {
    return (
      <section className="workspace-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center", display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 22, color: "#0f172a" }}>Drop PDF here</strong>
          <span style={{ fontSize: 13, color: "#64748b" }}>or click to upload</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={floatingButton}
          >
            PDF 업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onUpload(file);
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell" style={{ height: "100vh", overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40% 60%",
          gap: 0,
          flex: 1,
          minHeight: 0,
          borderTop: "1px solid #e2e8f0",
        }}
      >
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          position: "relative",
          display: "flex",
          overflow: "hidden",
          order: 2,
        }}
      >
      <div
        ref={scrollRef}
        onWheelCapture={pdfViewMode === "single" ? handleViewportWheel : undefined}
        style={{
          flex: 1,
          height: "100%",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 12,
          position: "relative",
          background: "#eef2ff",
          border: "2px solid #94a3b8",
          borderRadius: 12,
          boxShadow: "inset 0 0 0 1px #cbd5e1",
        }}
      >
        {canPreviewPdf && !pdfUnavailable && pdfAvailabilityChecked ? (
          <PdfPreviewClient
            key={selectedJob.id}
            fileUrl={`/api/jobs/${selectedJob.id}/pdf`}
            width={renderWidth}
            viewMode={pdfViewMode}
            focusedPage={currentPage}
            onFirstPageSize={setFirstPageSize}
            onPageSize={(pageNumber, size) => {
              setPageSizeByPage((prev) => ({ ...prev, [pageNumber]: size }));
            }}
            onPageTextMap={(pageNumber, blocks) => {
              setPageTextMapByPage((prev) => ({ ...prev, [pageNumber]: blocks }));
              const classified: ClassifiedPageResult = classifyPageType(blocks, pageNumber);
              setPageTypeByPage((prev) => ({ ...prev, [pageNumber]: classified.pageType }));
              setPageProfileByPage((prev) => ({ ...prev, [pageNumber]: classified.profile }));
              setPageScoresByPage((prev) => ({ ...prev, [pageNumber]: classified.scores }));
            }}
            renderOverlay={(pageNumber, pageSize) => (
              (() => {
                const pageBlocks = pageTextMapByPage[pageNumber] ?? [];
                const pageType = pageTypeOverrideByPage[pageNumber] ?? pageTypeByPage[pageNumber] ?? "body";
                const pageChunks = chunks.filter((chunk) => {
                  const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
                  if (!Array.isArray(range) || range.length !== 2) return pageNumber <= 1;
                  return pageNumber >= range[0] && pageNumber <= range[1];
                });
                const chunkAnchors = buildPageAnchors(pageChunks, pageBlocks, anchorCacheRef.current);
                const selectedRange = (selectedChunk?.meta as unknown as { pageRange?: [number, number] })?.pageRange;
                const selectedOnPage =
                  (selectedChunk &&
                    Array.isArray(selectedRange) &&
                    pageNumber >= selectedRange[0] &&
                    pageNumber <= selectedRange[1]) ||
                  selectedChunkAnchors?.page === pageNumber;
                const overlayEnabledForPage = appliedOverlayPages.has(pageNumber);
                return (
                  <div style={{ position: "absolute", inset: 0 }}>
                    {hoveredAnalyzerPage === pageNumber && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 2,
                          border: "2px solid rgba(37,99,235,0.95)",
                          borderRadius: 8,
                          background: "rgba(37,99,235,0.05)",
                          pointerEvents: "none",
                          zIndex: 5,
                        }}
                      />
                    )}
                    {overlayEnabledForPage ? (
                      <ChunkOverlayLayer
                        chunks={chunks}
                        pageNumber={pageNumber}
                        pageSize={pageSize}
                        selectedChunkId={selectedChunkId}
                        boundaryRatios={boundaryRatiosByPage[pageNumber]}
                        onBoundaryRatiosChange={(ratios) => {
                          setBoundaryRatiosByPage((prev) => ({ ...prev, [pageNumber]: ratios }));
                          const affectedIds = chunks
                            .filter((chunk) => {
                              const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
                              return Array.isArray(range) && pageNumber >= range[0] && pageNumber <= range[1];
                            })
                            .map((chunk) => chunk.meta.chunkId);
                          setModifiedChunkIds((prev) => {
                            const next = new Set(prev);
                            affectedIds.forEach((id) => next.add(id));
                            return next;
                          });
                        }}
                        onSelectChunk={selectChunk}
                        onHoverChunk={setHoverChunkId}
                        onChunkAnchorChange={setToolbarAnchor}
                        onHoverAnchorChange={setHoverAnchor}
                        chunkAnchors={chunkAnchors}
                        selectedTextBlocks={selectedOnPage ? selectedTextBlocks : []}
                        pageType={pageType}
                      />
                    ) : null}
                  </div>
                );
              })()
            )}
            onLoadSuccess={setNumPages}
            onLoadError={() => {
              setFailedPdfJobId(selectedJob.id);
              setPreviewFailureReason("원본 PDF 렌더링에 실패했습니다.");
            }}
          />
        ) : canPreviewPdf && !pdfAvailabilityChecked ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>PDF 미리보기 가능 여부를 확인 중입니다.</div>
        ) : (
          <div style={errorOverlay}>
            <div style={{ fontWeight: 700 }}>PDF 미리보기를 불러오지 못했습니다.</div>
            <div>{previewFailureReason ?? "원본 PDF 렌더링에 실패했습니다."}</div>
            <div>파일 형식 또는 렌더러 상태를 확인해 주세요.</div>
          </div>
        )}

        <div
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 60,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            maxWidth: "62vw",
          }}
          onMouseEnter={() => setFreezeCurrentPage(true)}
          onMouseLeave={() => setFreezeCurrentPage(false)}
        >
          <button
            type="button"
            style={floatingButton}
            onClick={() => {
              nudgeZoom(0.1);
            }}
          >
            +
          </button>
          <button
            type="button"
            style={floatingButton}
            onClick={() => {
              nudgeZoom(-0.1);
            }}
          >
            -
          </button>
          <div style={{ ...floatingButton, cursor: "default", background: "#f8fafc", color: "#334155" }}>
            {zoomPercentLabel}
          </div>
          <button
            type="button"
            style={{
              ...floatingButton,
              background: pdfViewMode === "continuous" ? "#e0e7ff" : "#fff",
              color: pdfViewMode === "continuous" ? "#3730a3" : "#0f172a",
            }}
            onClick={() => setPdfViewMode("continuous")}
          >
            전체 스크롤
          </button>
          <button
            type="button"
            style={{
              ...floatingButton,
              background: pdfViewMode === "single" ? "#e0e7ff" : "#fff",
              color: pdfViewMode === "single" ? "#3730a3" : "#0f172a",
            }}
            onClick={() => setPdfViewMode("single")}
          >
            페이지 단위
          </button>
          <div style={{ ...floatingButton, cursor: "default", background: "#f8fafc", color: "#334155" }}>
            page {currentPage}/{Math.max(1, numPages)}
          </div>
        </div>

        {currentPageProfile && currentPageScores && (
          <div
            style={{
              position: "fixed",
              top: 52,
              left: 12,
              zIndex: 39,
              background: "rgba(255,255,255,0.94)",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 10,
              color: "#475569",
              display: "grid",
              gap: 2,
              minWidth: 260,
            }}
          >
            <div>
              blocks {currentPageProfile.textBlockCount} / avgLen{" "}
              {Math.round(currentPageProfile.averageLineLength)}
            </div>
            <div>
              score c:{currentPageScores.coverScore.toFixed(2)} t:{currentPageScores.tocScore.toFixed(2)} tb:
              {currentPageScores.tableScore.toFixed(2)} b:{currentPageScores.bodyScore.toFixed(2)} r:
              {currentPageScores.revisionScore.toFixed(2)}
            </div>
          </div>
        )}

        {hasFallbackChunk && (
          <div
            style={{
              position: "fixed",
              top: 56,
              left: 12,
              zIndex: 47,
              background: "rgba(255,255,255,0.97)",
              border: "1px solid #f59e0b",
              borderRadius: 10,
              padding: "8px 10px",
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
              display: "grid",
              gap: 6,
              minWidth: 320,
            }}
          >
            <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
              텍스트 추출 fallback 청크가 감지되었습니다.
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              실제 본문 청킹 결과가 아닐 수 있습니다. 재업로드 또는 재청킹을 실행해 주세요.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={floatingButton}
                onClick={() => fileInputRef.current?.click()}
              >
                PDF 재업로드
              </button>
              <button
                type="button"
                style={floatingButton}
                onClick={() => void handleRechunk()}
                disabled={rechunking}
              >
                {rechunking ? "재청킹 중..." : "재청킹"}
              </button>
            </div>
            {fallbackActionError && (
              <div style={{ fontSize: 11, color: "#b91c1c" }}>{fallbackActionError}</div>
            )}
          </div>
        )}

        {selectedChunk && (
          <div style={{ position: "fixed", top: toolbarPosition.top, left: toolbarPosition.left, zIndex: 45 }}>
            {qualityInsight && (
              <div
                style={{
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "rgba(255,255,255,0.95)",
                  padding: "6px 8px",
                  fontSize: 11,
                  color: "#334155",
                  maxWidth: 480,
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Quality Insight</div>
                <div style={{ marginTop: 2 }}>{qualityInsight.message}</div>
                <div style={{ marginTop: 2, color: "#64748b" }}>
                  Suggested: {qualityInsight.suggestedActions.join(" · ")}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, padding: 6, borderRadius: 10, background: "rgba(255,255,255,0.95)", border: "1px solid #dbe3f1", boxShadow: "0 6px 16px rgba(15,23,42,0.12)" }}>
              <button type="button" style={floatingButton} onClick={() => setMergeMenuOpen((v) => !v)}>Merge</button>
              <button type="button" style={floatingButton} onClick={splitSelectedChunk}>Split</button>
              <button type="button" style={floatingButton} onClick={toggleExcludeSelectedChunk}>Exclude</button>
              <button
                type="button"
                style={floatingButton}
                onClick={() => {
                  setInspectorOpen(true);
                  setInspectorExpanded(true);
                  window.setTimeout(() => {
                    labelInputRef.current?.focus();
                    labelInputRef.current?.select();
                  }, 0);
                }}
              >
                Edit Label
              </button>
              <button type="button" style={floatingButton} onClick={triggerAiSuggestion}>AI Suggest</button>
            </div>
            {mergeMenuOpen && (
              <div style={{ marginTop: 6, display: "flex", gap: 6, padding: 6, borderRadius: 10, background: "rgba(255,255,255,0.96)", border: "1px solid #dbe3f1", boxShadow: "0 4px 12px rgba(15,23,42,0.1)" }}>
                <button type="button" style={floatingButton} onClick={() => mergeWith("prev")} disabled={selectedChunkIndex <= 0}>
                  merge prev
                </button>
                <button
                  type="button"
                  style={floatingButton}
                  onClick={() => mergeWith("next")}
                  disabled={selectedChunkIndex < 0 || selectedChunkIndex >= chunks.length - 1}
                >
                  merge next
                </button>
              </div>
            )}
          </div>
        )}

        {hoverChunk && !selectedChunk && (
          <div
            style={{
              position: "fixed",
              top: clamp((hoverAnchor?.y ?? 64) - 10, 12, Math.max(220, viewportSize.height - 170)),
              left: clamp((hoverAnchor?.x ?? 16) + 10, 12, Math.max(340, viewportSize.width - 320)),
              zIndex: 44,
              maxWidth: 300,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid #dbe3f1",
              borderRadius: 10,
              padding: 8,
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
              fontSize: 11,
              color: "#334155",
            }}
          >
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Chunk Preview</div>
            <div style={{ marginTop: 2 }}>{hoverChunkPreview}</div>
            <div style={{ marginTop: 5, color: "#0f172a", fontWeight: 700 }}>Quality</div>
            <div style={{ marginTop: 1, color: "#64748b" }}>{qualityLabel(hoverChunk)}</div>
            <div style={{ marginTop: 5, color: "#0f172a", fontWeight: 700 }}>Tokens</div>
            <div style={{ marginTop: 1, color: "#64748b" }}>{hoverChunk.meta.quality.tokens}</div>
          </div>
        )}

        {selectedChunk && inspectorOpen && (
          <div
            style={{
              position: "fixed",
              top: toolbarPosition.top + 84,
              left: clamp(toolbarPosition.left + 40, 12, Math.max(380, viewportSize.width - 360)),
              width: 320,
              maxHeight: inspectorExpanded ? "62vh" : "34vh",
              overflow: "auto",
              background: "#fff",
              border: "1px solid #dbe3f1",
              borderRadius: 12,
              padding: 12,
              zIndex: 42,
              boxShadow: "0 8px 24px rgba(15,23,42,0.16)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13, color: "#0f172a" }}>Chunk Inspector</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setInspectorExpanded((v) => !v)}
                  style={inspectorMiniBtn}
                >
                  {inspectorExpanded ? "접기" : "확장"}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(false)}
                  style={inspectorMiniBtn}
                >
                  닫기
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
              {selectedChunkPreview}
            </div>
            <Row label="Location" value={formatChunkLocation(selectedChunk, chunks, selectedChunkIndex)} />
            {selectedChunk.meta.sectionTitle && (
              <Row label="Section" value={selectedChunk.meta.sectionTitle} />
            )}
            <Row label="Quality" value={selectedChunkQuality ?? "Unknown"} />
            {qualityInsight && (
              <div style={{ fontSize: 11, color: "#475569" }}>
                {qualityInsight.message}
              </div>
            )}

            {inspectorExpanded && (
              <>
                <textarea
                  readOnly
                  value={selectedChunkText}
                  onClick={(e) => setSplitCursorOffset((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  onKeyUp={(e) => setSplitCursorOffset((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  style={{ minHeight: 150, maxHeight: 250, resize: "vertical", ...textInput }}
                />
                <label style={{ fontSize: 12, color: "#334155", display: "grid", gap: 4 }}>
                  레이블 수정
                  <input
                    ref={labelInputRef}
                    value={editedLabels[selectedChunk.meta.chunkId] ?? selectedChunk.meta.sectionTitle ?? ""}
                    onChange={(e) =>
                      setEditedLabels((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                    }
                    style={textInput}
                  />
                </label>
                <label style={{ fontSize: 12, color: "#334155", display: "grid", gap: 4 }}>
                  검토 메모
                  <textarea
                    rows={3}
                    value={reviewNotes[selectedChunk.meta.chunkId] ?? ""}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                    }
                    style={{ ...textInput, resize: "vertical" }}
                  />
                </label>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#64748b" }}>Metadata (확장)</summary>
                  <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                    <Row label="chunk id" value={selectedChunk.meta.chunkId} />
                    <Row label="tokens" value={String(selectedChunk.meta.quality.tokens ?? 0)} />
                    <Row label="section" value={selectedChunk.meta.sectionPath.join(" > ") || "Unsectioned"} />
                  </div>
                </details>
              </>
            )}
          </div>
        )}

        {aiSuggestion && selectedChunk && (
          <div
            style={{
              position: "fixed",
              top: toolbarPosition.top + 52,
              left: toolbarPosition.left,
              zIndex: 46,
              ...errorOverlay,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>AI Suggestion</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{aiSuggestion}</div>
            <button
              type="button"
              style={{ ...floatingButton, marginTop: 8 }}
              onClick={() => setAiSuggestion(null)}
            >
              닫기
            </button>
          </div>
        )}

        <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 50 }}>
          <button type="button" style={floatingButton} onClick={() => setSettingsOpen((v) => !v)}>
            ⚙
          </button>
          {settingsOpen && (
            <div style={{ marginTop: 8, background: "#fff", border: "1px solid #dbe3f1", borderRadius: 10, padding: 8, display: "grid", gap: 6, minWidth: 180 }}>
              <button type="button" style={menuBtn} onClick={() => fileInputRef.current?.click()}>
                Upload PDF
              </button>
              <button type="button" style={menuBtn} onClick={() => void onReload()}>
                Reload document
              </button>
              <button type="button" style={menuBtn} onClick={() => void handleExport()}>
                Export dataset
              </button>
              <Link href="/workspace/settings" style={{ ...menuLink }}>Workspace settings</Link>
              <Link href="/jobs" style={{ ...menuLink }}>Job list</Link>
              {exportError && <div style={{ fontSize: 11, color: "#b91c1c" }}>{exportError}</div>}
              {loading && <div style={{ fontSize: 11, color: "#64748b" }}>문서를 분석 중입니다.</div>}
              {error && <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div>}
              <div style={{ fontSize: 11, color: "#64748b" }}>Pages: {numPages || "-"}</div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onUpload(file);
          }}
        />
      </div>
      </div>
      <aside
        style={{
          minHeight: 0,
          overflowY: "auto",
          borderRight: "1px solid #e2e8f0",
          background: "#ffffff",
          padding: 12,
          display: "grid",
          gap: 10,
          alignContent: "start",
          order: 1,
        }}
        aria-label="Page Type Analyzer"
      >
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ fontSize: 14, color: "#0f172a" }}>Page Type Analyzer</strong>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            페이지 구조를 먼저 점검하고 필요하면 타입을 수동 보정하세요.
          </span>
        </div>
        <div
          style={{
            border: "1px solid #dbe3f1",
            borderRadius: 10,
            padding: 10,
            display: "grid",
            gap: 8,
            background: "#f8fafc",
          }}
        >
          <div style={{ fontSize: 12, color: "#334155" }}>선택 즉시 반영 · 선택 {selectedOverlayCount}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={floatingButton} onClick={selectAllOverlayPages}>
              전체 선택
            </button>
            <button type="button" style={floatingButton} onClick={clearOverlaySelection}>
              초기화
            </button>
          </div>
        </div>
        {pageProfiles.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>페이지 분석 데이터를 준비 중입니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {pageProfiles.map((profile) => (
              <button
                key={`page-profile-${profile.pageNumber}`}
                type="button"
                onMouseEnter={() => setHoveredAnalyzerPage(profile.pageNumber)}
                onMouseLeave={() => setHoveredAnalyzerPage(null)}
                onClick={() => scrollToPage(profile.pageNumber)}
                style={{
                  textAlign: "left",
                  border: "1px solid #dbe3f1",
                  borderRadius: 10,
                  background:
                    currentPage === profile.pageNumber ? "rgba(59,130,246,0.08)" : "#fff",
                  padding: 10,
                  display: "grid",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13, color: "#0f172a" }}>Page {profile.pageNumber}</strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {Math.round(profile.confidence * 100)}%
                  </span>
                </div>
                <Row label="orientation" value={profile.orientation} />
                <Row label="type" value={profile.pageType} />
                <Row
                  label="confidence"
                  value={profile.confidence > 0 ? profile.confidence.toFixed(2) : "-"}
                />
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={overlaySelectionByPage[profile.pageNumber] ?? false}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setOverlaySelectionByPage((prev) => ({
                        ...prev,
                        [profile.pageNumber]: checked,
                      }));
                      setAppliedOverlayPages((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(profile.pageNumber);
                        else next.delete(profile.pageNumber);
                        return next;
                      });
                    }}
                  />
                  이 페이지 오버레이 반영
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569" }}>
                  override
                  <select
                    value={pageTypeOverrideByPage[profile.pageNumber] ?? ""}
                    onChange={(event) => {
                      event.stopPropagation();
                      const value = event.target.value as PageType | "";
                      setPageTypeOverrideByPage((prev) => ({
                        ...prev,
                        [profile.pageNumber]: value === "" ? null : value,
                      }));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "#fff",
                      fontSize: 12,
                      padding: "6px 8px",
                      color: "#334155",
                    }}
                  >
                    <option value="">auto ({pageTypeByPage[profile.pageNumber] ?? "body"})</option>
                    <option value="cover">cover</option>
                    <option value="toc">toc</option>
                    <option value="table">table</option>
                    <option value="body">body</option>
                    <option value="revision_or_form">revision_or_form</option>
                  </select>
                </label>
              </button>
            ))}
          </div>
        )}
      </aside>
      </div>
    </section>
  );
}

function qualityLabel(chunk: ChunkDTO): string {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  if (tokens < 80) return "Too Short";
  if (tokens > 900) return "Too Long";
  if (tokens < 150) return "Review";
  return "Good";
}

function buildAiSuggestion(chunk: ChunkDTO, chunks: ChunkDTO[], chunkIndex: number): string {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  const hasWarnings = (chunk.meta.quality?.warnings?.length ?? 0) > 0;
  if (tokens > 900) return "Chunk too long, split near sentence 4 recommended.";
  if (tokens < 80) {
    const neighbor = chunks[chunkIndex + 1] ?? chunks[chunkIndex - 1];
    return `Chunk too short, merge with ${neighbor ? neighbor.meta.chunkId : "adjacent chunk"} recommended.`;
  }
  if (hasWarnings) return "Boundary unclear, review this section manually.";
  const prev = chunkIndex > 0 ? chunks[chunkIndex - 1] : null;
  const next = chunkIndex >= 0 && chunkIndex < chunks.length - 1 ? chunks[chunkIndex + 1] : null;
  const overlapPrev = prev ? textSimilarity(chunk.text, prev.text) : 0;
  const overlapNext = next ? textSimilarity(chunk.text, next.text) : 0;
  if (Math.max(overlapPrev, overlapNext) >= 0.42) {
    return overlapNext >= overlapPrev
      ? "Semantic overlap detected. Consider merging with the next chunk."
      : "Semantic overlap detected. Consider merging with the previous chunk.";
  }
  if ((chunk.meta.sectionTitle ?? "").length < 4) return "Label is vague, refine section label for retrieval quality.";
  return "Boundary looks stable. Keep this chunk and continue review.";
}

function formatChunkLocation(chunk: ChunkDTO, chunks: ChunkDTO[], chunkIndex: number): string {
  const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
  if (Array.isArray(range) && range.length === 2) {
    if (range[0] === range[1]) return `Page ${range[0]}`;
    return `Page ${range[0]}-${range[1]}`;
  }
  const blockStart = chunk.meta.startBlockIdx;
  if (Number.isFinite(blockStart)) {
    const maxBlock = Math.max(
      1,
      ...chunks.map((entry) => entry.meta.endBlockIdx ?? entry.meta.startBlockIdx ?? 0)
    );
    const ratio = blockStart / maxBlock;
    if (ratio < 0.34) return "Approx. Top of page";
    if (ratio < 0.67) return "Approx. Middle of page";
    return "Approx. Bottom of page";
  }
  if (chunkIndex <= 0) return "Approx. Top of page";
  if (chunkIndex >= Math.max(0, chunks.length - 2)) return "Approx. Bottom of page";
  return "Approx. Middle of page";
}

function buildPreviewSnippet(text: string, lines: number): string {
  const normalized = normalizePreviewText(text);
  if (!normalized) return "청크 미리보기를 불러오지 못했습니다.";
  const sentences = normalized
    .split(/(?<=[.!?。])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = sentences.slice(0, Math.max(1, Math.min(4, lines)));
  if (picked.length === 0) return normalized.slice(0, 180);
  return picked.join(" ");
}

function normalizePreviewText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n/g, " ")
    .trim();
}

function buildQualityInsight(chunk: ChunkDTO, chunks: ChunkDTO[], index: number): {
  message: string;
  suggestedActions: string[];
} {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  const warnings = chunk.meta.quality?.warnings ?? [];
  if (tokens < 80 || warnings.includes("TOO_SHORT")) {
    return {
      message: "This chunk is too short and may not contain enough semantic context.",
      suggestedActions: [index < chunks.length - 1 ? "Merge with next" : "Merge with previous", "AI Suggest"],
    };
  }
  if (tokens > 900 || warnings.includes("TOO_LONG")) {
    return {
      message: "This chunk is too long and may reduce retrieval precision.",
      suggestedActions: ["Split chunk", "AI Suggest"],
    };
  }
  if (warnings.includes("UNCLEAR_BOUNDARY")) {
    return {
      message: "Boundary is unclear and may overlap neighboring semantics.",
      suggestedActions: ["Split chunk", "Merge review"],
    };
  }
  return {
    message: "Chunk quality is stable for semantic retrieval.",
    suggestedActions: ["Keep", "Optional AI Suggest"],
  };
}

function buildPageAnchors(
  pageChunks: ChunkDTO[],
  pageBlocks: PageTextBlock[],
  cache: Record<string, { top: number; bottom: number; left: number; right: number }>
): Record<string, { top: number; bottom: number; left: number; right: number }> {
  if (pageBlocks.length === 0 || pageChunks.length === 0) return {};
  const mapped: Record<string, { top: number; bottom: number; left: number; right: number }> = {};
  for (const chunk of pageChunks) {
    const resolved = resolveChunkAnchor(chunk, pageBlocks, cache);
    if (resolved) mapped[chunk.meta.chunkId] = resolved;
  }
  return mapped;
}

function resolveChunkAnchor(
  chunk: ChunkDTO,
  pageBlocks: PageTextBlock[],
  cache: Record<string, { top: number; bottom: number; left: number; right: number }>
): { top: number; bottom: number; left: number; right: number } | null {
  if (cache[chunk.meta.chunkId]) return cache[chunk.meta.chunkId];
  if (pageBlocks.length === 0) return null;
  const preview = buildPreviewSnippet(chunk.text, 1).toLowerCase();
  const key = preview.replace(/\s+/g, "").slice(0, 28);
  if (!key) return null;
  let matchStart = -1;
  let matchEnd = -1;
  for (let i = 0; i < pageBlocks.length; i += 1) {
    let joined = "";
    for (let j = i; j < Math.min(pageBlocks.length, i + 12); j += 1) {
      joined += (pageBlocks[j]?.text ?? "").toLowerCase().replace(/\s+/g, "");
      const probe = key.slice(0, Math.min(20, key.length));
      if (probe.length >= 8 && (joined.includes(probe) || probe.includes(joined.slice(0, probe.length)))) {
        matchStart = i;
        matchEnd = j;
        break;
      }
    }
    if (matchStart >= 0) break;
  }
  if (matchStart < 0 || matchEnd < 0) return null;
  const selected = pageBlocks.slice(matchStart, matchEnd + 1);
  const top = Math.max(0, Math.min(...selected.map((block) => block.y)) - 3);
  const bottom = Math.max(...selected.map((block) => block.y + block.height)) + 3;
  const left = Math.max(0, Math.min(...selected.map((block) => block.x)) - 6);
  const right = Math.max(...selected.map((block) => block.x + block.width)) + 6;
  const anchor = { top, bottom, left, right };
  cache[chunk.meta.chunkId] = anchor;
  return anchor;
}

function intersects(
  block: { x: number; y: number; width: number; height: number },
  anchor: { top: number; bottom: number; left: number; right: number }
): boolean {
  const bLeft = block.x;
  const bRight = block.x + block.width;
  const bTop = block.y;
  const bBottom = block.y + block.height;
  return bRight >= anchor.left && bLeft <= anchor.right && bBottom >= anchor.top && bTop <= anchor.bottom;
}

function textSimilarity(a: string, b: string): number {
  const tokensA = toTokenSet(a);
  const tokensB = toTokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection += 1;
  });
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

function toTokenSet(text: string): Set<string> {
  const normalized = normalizePreviewText(text).toLowerCase();
  const tokens = normalized.split(/[^0-9a-zA-Z가-힣]+/).filter((token) => token.length >= 2);
  return new Set(tokens.slice(0, 80));
}

function estimateConfidence(scores?: PageTypeScores): number {
  if (!scores) return 0;
  const values = [
    scores.coverScore,
    scores.tocScore,
    scores.tableScore,
    scores.bodyScore,
    scores.revisionScore,
  ].sort((a, b) => b - a);
  const top = values[0] ?? 0;
  const second = values[1] ?? 0;
  return clamp(top - second * 0.35 + 0.2, 0, 1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

const textInput = {
  width: "100%",
  border: "1px solid #d7deea",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
} as const;

const floatingButton = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
} as const;

const errorOverlay = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.6,
  maxWidth: 360,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
} as const;

const menuBtn = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "6px 8px",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left",
} as const;

const menuLink = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "6px 8px",
  fontSize: 12,
  textDecoration: "none",
  color: "#334155",
} as const;

const inspectorMiniBtn = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  fontSize: 12,
  padding: "2px 8px",
  cursor: "pointer",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
