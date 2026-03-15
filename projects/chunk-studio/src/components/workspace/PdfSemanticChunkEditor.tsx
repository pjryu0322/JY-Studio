"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import { type PageType } from "./pageTypeClassifier";
import {
  classifyPageUnderstanding,
  type DocumentFamily,
  type PageClassificationRecord,
  type PageOrientation,
  type PageSubType,
} from "@/lib/analysis/pageUnderstanding";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import { fireWorkspaceAudit } from "./AuditActionClient";
import {
  buildChunkSuggestion,
  mergeChunkWithNext,
  splitChunkAtMidpoint,
} from "./workspaceChunkEditing";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

type PdfViewMode = "continuous" | "single";

interface PdfFirstPageSize {
  width: number;
  height: number;
}

interface PdfSemanticChunkEditorProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onReload: () => Promise<void>;
}

interface DragBoundaryState {
  chunkId: string;
  pageNumber: number;
  handle: "top" | "bottom";
  startClientY: number;
  startY: number;
  startH: number;
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
  const [firstPageSize, setFirstPageSize] = useState<PdfFirstPageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSizeByPage, setPageSizeByPage] = useState<Record<number, { width: number; height: number }>>({});
  const [familyHint, setFamilyHint] = useState<DocumentFamily>("guide_manual");
  const [recordByPage, setRecordByPage] = useState<Record<number, PageClassificationRecord>>({});
  const [hoveredAnalyzerPage, setHoveredAnalyzerPage] = useState<number | null>(null);
  const [analysisHealth, setAnalysisHealth] = useState<{
    mode: "external" | "local-fallback";
    available: boolean;
    message: string;
  } | null>(null);
  const [localChunks, setLocalChunks] = useState<ChunkDTO[]>([]);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<string>>(new Set());
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [overlayAnchorByKey, setOverlayAnchorByKey] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [dragBoundary, setDragBoundary] = useState<DragBoundaryState | null>(null);
  const analyzedPageRef = useRef<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wheelSwitchAtRef = useRef(0);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const selectedJobId = selectedJob?.id ?? null;
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const currentPageRecord = recordByPage[currentPage] ?? null;
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
    if (!numPages) return [] as PageClassificationRecord[];
    const items: PageClassificationRecord[] = [];
    for (let page = 1; page <= numPages; page += 1) {
      const pageSize = pageSizeByPage[page] ?? firstPageSize ?? { width: 1, height: 1 };
      const existing = recordByPage[page];
      if (existing) {
        items.push(existing);
        continue;
      }
      items.push(
        classifyPageUnderstanding({
          pageNumber: page,
          pageSize,
          blocks: [],
          familyHint,
        })
      );
    }
    return items;
  }, [numPages, pageSizeByPage, firstPageSize, recordByPage, familyHint]);

  const visibleChunks = useMemo(() => {
    return localChunks
      .filter((chunk) => !excludedChunkIds.has(chunk.meta.chunkId))
      .map((chunk) => {
        const editedLabel = editedLabels[chunk.meta.chunkId];
        if (!editedLabel) return chunk;
        return {
          ...chunk,
          meta: {
            ...chunk.meta,
            sectionTitle: editedLabel,
          },
        };
      });
  }, [localChunks, excludedChunkIds, editedLabels]);

  const selectedChunk = useMemo(() => {
    if (!visibleChunks.length) return null;
    if (!selectedChunkId) return visibleChunks[0];
    return visibleChunks.find((chunk) => chunk.meta.chunkId === selectedChunkId) ?? visibleChunks[0];
  }, [visibleChunks, selectedChunkId]);


  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    setCurrentPage(1);
    setZoom(1);
    setPageSizeByPage({});
    setRecordByPage({});
    setSelectedChunkId(null);
    setLocalChunks([]);
    setExcludedChunkIds(new Set());
    setEditedLabels({});
    setReviewNotes({});
    setOverlayAnchorByKey({});
    setDragBoundary(null);
    analyzedPageRef.current = new Set();
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    setLocalChunks((prev) => (prev.length > 0 ? prev : detail?.chunks ?? []));
  }, [detail?.chunks, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    try {
      const raw = window.localStorage.getItem(`chunkstudio:page-records:${selectedJobId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<number, PageClassificationRecord>;
      setRecordByPage(parsed);
    } catch {
      // ignore corrupted local cache
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    try {
      window.localStorage.setItem(
        `chunkstudio:page-records:${selectedJobId}`,
        JSON.stringify(recordByPage)
      );
    } catch {
      // best-effort local persistence
    }
  }, [recordByPage, selectedJobId]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/analysis/health");
        const payload = (await res.json()) as {
          mode: "external" | "local-fallback";
          available: boolean;
          message: string;
        };
        if (!cancelled) setAnalysisHealth(payload);
      } catch {
        if (!cancelled) {
          setAnalysisHealth({
            mode: "local-fallback",
            available: false,
            message: "Analysis health check failed.",
          });
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dragBoundary) return;
    const onMove = (event: MouseEvent) => {
      const deltaPx = event.clientY - dragBoundary.startClientY;
      const deltaNorm = deltaPx / Math.max(1, renderWidth * 1.414);
      const key = `${dragBoundary.chunkId}:${dragBoundary.pageNumber}`;
      setOverlayAnchorByKey((prev) => {
        const current = prev[key] ?? {
          x: 0.06,
          y: dragBoundary.startY,
          w: 0.88,
          h: dragBoundary.startH,
        };
        if (dragBoundary.handle === "top") {
          const nextY = clamp(current.y + deltaNorm, 0.01, current.y + current.h - 0.02);
          const diff = nextY - current.y;
          const nextH = clamp(current.h - diff, 0.02, 0.98);
          return { ...prev, [key]: { ...current, y: nextY, h: nextH } };
        }
        const nextH = clamp(current.h + deltaNorm, 0.02, 0.98 - current.y);
        return { ...prev, [key]: { ...current, h: nextH } };
      });
    };
    const onUp = () => {
      fireWorkspaceAudit(selectedJobId, "boundary_drag", {
        chunkId: dragBoundary.chunkId,
        page: dragBoundary.pageNumber,
        handle: dragBoundary.handle,
      });
      setDragBoundary(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragBoundary, renderWidth, selectedJobId]);

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
  const nudgeZoom = (delta: number) => {
    const pageSize =
      pdfViewMode === "single" ? pageSizeByPage[currentPage] ?? firstPageSize : firstPageSize;
    const basePageWidth = Math.max(1, pageSize?.width ?? firstPageSize?.width ?? 1);
    const currentScale = renderWidth / basePageWidth;
    const nextScale = clamp(Number((currentScale + delta).toFixed(2)), 0.2, 3);
    setZoom(nextScale);
  };

  const startBoundaryDrag = (
    event: ReactMouseEvent<HTMLDivElement>,
    input: { chunkId: string; pageNumber: number; handle: "top" | "bottom"; y: number; h: number }
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragBoundary({
      chunkId: input.chunkId,
      pageNumber: input.pageNumber,
      handle: input.handle,
      startClientY: event.clientY,
      startY: input.y,
      startH: input.h,
    });
  };

  const fireAudit = (action: string, detailData?: Record<string, unknown>) => {
    fireWorkspaceAudit(selectedJobId, action, detailData);
  };

  const applyMergeWithNext = (chunkId: string) => {
    setLocalChunks((prev) => mergeChunkWithNext(prev, chunkId));
  };

  const applySplitAtMidpoint = (chunkId: string) => {
    setLocalChunks((prev) => splitChunkAtMidpoint(prev, chunkId));
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
              if (analyzedPageRef.current.has(pageNumber)) return;
              analyzedPageRef.current.add(pageNumber);
              const pageSize = pageSizeByPage[pageNumber] ?? firstPageSize ?? { width: 1, height: 1 };
              const localRecord = classifyPageUnderstanding({
                pageNumber,
                pageSize,
                blocks,
                familyHint,
              });
              setRecordByPage((prev) => ({ ...prev, [pageNumber]: localRecord }));
              void (async () => {
                try {
                  const res = await fetch("/api/analysis/page-understanding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pageNumber,
                      pageSize,
                      blocks,
                      familyHint,
                    }),
                  });
                  if (!res.ok) return;
                  const remote = (await res.json()) as PageClassificationRecord;
                  setRecordByPage((prev) => ({ ...prev, [pageNumber]: remote }));
                } catch {
                  // keep local classifier result
                }
              })();
            }}
            renderOverlay={(pageNumber) => {
              const chunkOverlays = visibleChunks
                .map((chunk) => ({ chunk, mapped: mapChunkToPage(chunk) }))
                .filter(({ mapped }) => {
                  if (mapped.pageStart == null || mapped.pageEnd == null) return false;
                  return mapped.pageStart <= pageNumber && pageNumber <= mapped.pageEnd;
                });
              if (chunkOverlays.length === 0 && hoveredAnalyzerPage !== pageNumber) return null;
              return (
                <>
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
                  {chunkOverlays.map(({ chunk }, idx) => {
                    const key = `${chunk.meta.chunkId}:${pageNumber}`;
                    const block = overlayAnchorByKey[key] ??
                      (chunk.meta as unknown as { bboxList?: Array<{ x: number; y: number; w: number; h: number }> }).bboxList?.[0];
                    const fallbackTop = 0.02 + (idx % 7) * 0.13;
                    const top = block ? Math.max(0, block.y) : fallbackTop;
                    const left = block ? Math.max(0, block.x) : 0.06;
                    const width = block ? Math.max(0.01, block.w) : 0.88;
                    const height = block ? Math.max(0.01, block.h) : 0.09;
                    const isSelected = selectedChunk?.meta.chunkId === chunk.meta.chunkId;
                    return (
                      <button
                        key={`${chunk.meta.chunkId}-${idx}`}
                        type="button"
                        onClick={() => setSelectedChunkId(chunk.meta.chunkId)}
                        style={{
                          position: "absolute",
                          left: `${left * 100}%`,
                          top: `${top * 100}%`,
                          width: `${width * 100}%`,
                          height: `${height * 100}%`,
                          border: isSelected
                            ? "2px solid rgba(249,115,22,0.95)"
                            : "2px solid rgba(37,99,235,0.75)",
                          background: isSelected
                            ? "rgba(249,115,22,0.22)"
                            : "rgba(37,99,235,0.10)",
                          borderRadius: 6,
                          cursor: "pointer",
                          zIndex: isSelected ? 9 : 7,
                        }}
                        title={chunk.text.slice(0, 80)}
                      >
                        {isSelected && (
                          <>
                            <div
                              onMouseDown={(event) =>
                                startBoundaryDrag(event, {
                                  chunkId: chunk.meta.chunkId,
                                  pageNumber,
                                  handle: "top",
                                  y: top,
                                  h: height,
                                })
                              }
                              style={{
                                position: "absolute",
                                left: "40%",
                                right: "40%",
                                top: -6,
                                height: 8,
                                borderRadius: 999,
                                background: "#f97316",
                                cursor: "ns-resize",
                              }}
                            />
                            <div
                              onMouseDown={(event) =>
                                startBoundaryDrag(event, {
                                  chunkId: chunk.meta.chunkId,
                                  pageNumber,
                                  handle: "bottom",
                                  y: top,
                                  h: height,
                                })
                              }
                              style={{
                                position: "absolute",
                                left: "40%",
                                right: "40%",
                                bottom: -6,
                                height: 8,
                                borderRadius: 999,
                                background: "#f97316",
                                cursor: "ns-resize",
                              }}
                            />
                          </>
                        )}
                      </button>
                    );
                  })}
                </>
              );
            }}
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

        {currentPageRecord && (
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
              blocks {currentPageRecord.features.textBlockCount} / avgLen{" "}
              {Math.round(currentPageRecord.features.averageLineLength)}
            </div>
            <div>
              score c:{currentPageRecord.scores.coverScore.toFixed(2)} t:{currentPageRecord.scores.tocScore.toFixed(2)} tb:
              {currentPageRecord.scores.tableScore.toFixed(2)} b:{currentPageRecord.scores.bodyScore.toFixed(2)} r:
              {currentPageRecord.scores.revisionScore.toFixed(2)}
            </div>
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
              <Link href="/workspace/settings" style={{ ...menuLink }}>Workspace settings</Link>
              <Link href="/jobs" style={{ ...menuLink }}>Job list</Link>
              {loading && <div style={{ fontSize: 11, color: "#64748b" }}>문서를 분석 중입니다.</div>}
              {error && <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div>}
              <div style={{ fontSize: 11, color: "#64748b" }}>Pages: {numPages || "-"}</div>
              {analysisHealth && (
                <div
                  style={{
                    fontSize: 11,
                    color: analysisHealth.available ? "#166534" : "#b91c1c",
                    border: "1px solid #dbe3f1",
                    borderRadius: 7,
                    padding: "6px 8px",
                    background: "#f8fafc",
                  }}
                >
                  Analysis: {analysisHealth.mode} / {analysisHealth.available ? "ok" : "degraded"}
                  <div style={{ marginTop: 2, color: "#64748b" }}>{analysisHealth.message}</div>
                </div>
              )}
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
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#334155" }}>
            document family
            <select
              value={familyHint}
              onChange={(e) => setFamilyHint(e.target.value as DocumentFamily)}
              style={selector}
            >
              <option value="guide_manual">guide_manual</option>
              <option value="public_rfp">public_rfp</option>
              <option value="policy_manual">policy_manual</option>
              <option value="unknown_generic">unknown_generic</option>
            </select>
          </label>
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
                <Row label="orientation" value={profile.orientationFinal} />
                <Row label="type" value={profile.pageTypeFinal} />
                <Row label="subtype" value={profile.subTypeFinal} />
                <Row
                  label="confidence"
                  value={profile.confidence > 0 ? profile.confidence.toFixed(2) : "-"}
                />
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569" }}>
                  orientation override
                  <select
                    value={profile.orientationFinal}
                    onChange={(event) => {
                      event.stopPropagation();
                      const value = event.target.value as PageOrientation;
                      setRecordByPage((prev) => ({
                        ...prev,
                        [profile.pageNumber]: {
                          ...profile,
                          orientationFinal: value,
                          userOverridden: true,
                        },
                      }));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    style={selector}
                  >
                    <option value="portrait">portrait</option>
                    <option value="landscape">landscape</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569" }}>
                  page type override
                  <select
                    value={profile.pageTypeFinal}
                    onChange={(event) => {
                      event.stopPropagation();
                      const value = event.target.value as PageType;
                      setRecordByPage((prev) => ({
                        ...prev,
                        [profile.pageNumber]: {
                          ...profile,
                          pageTypeFinal: value,
                          userOverridden: true,
                        },
                      }));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    style={selector}
                  >
                    <option value="cover">cover</option>
                    <option value="toc">toc</option>
                    <option value="table">table</option>
                    <option value="body">body</option>
                    <option value="revision_or_form">revision_or_form</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569" }}>
                  subtype override
                  <select
                    value={profile.subTypeFinal}
                    onChange={(event) => {
                      event.stopPropagation();
                      const value = event.target.value as PageSubType;
                      setRecordByPage((prev) => ({
                        ...prev,
                        [profile.pageNumber]: {
                          ...profile,
                          subTypeFinal: value,
                          userOverridden: true,
                        },
                      }));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    style={selector}
                  >
                    <option value="title_cover">title_cover</option>
                    <option value="revision_history_table">revision_history_table</option>
                    <option value="narrative_body">narrative_body</option>
                    <option value="body_with_diagram">body_with_diagram</option>
                    <option value="body_with_table">body_with_table</option>
                    <option value="table_reference">table_reference</option>
                    <option value="body_with_examples">body_with_examples</option>
                  </select>
                </label>
              </button>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>Semantic Chunk Editor</strong>
          <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {visibleChunks.map((chunk) => {
              const selected = selectedChunk?.meta.chunkId === chunk.meta.chunkId;
              const mapped = mapChunkToPage(chunk);
              return (
                <button
                  key={chunk.meta.chunkId}
                  type="button"
                  onClick={() => {
                    setSelectedChunkId(chunk.meta.chunkId);
                    if (mapped.pageStart) scrollToPage(mapped.pageStart);
                  }}
                  style={{
                    textAlign: "left",
                    border: selected ? "1px solid #2563eb" : "1px solid #dbe3f1",
                    borderRadius: 8,
                    background: selected ? "#eff6ff" : "#fff",
                    padding: 8,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <strong style={{ fontSize: 12, color: "#0f172a" }}>{chunk.meta.chunkId}</strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    page {mapped.pageStart ?? "-"}~{mapped.pageEnd ?? "-"}
                  </span>
                  <span style={{ fontSize: 11, color: "#334155" }}>{chunk.text.slice(0, 120)}</span>
                </button>
              );
            })}
            {visibleChunks.length === 0 && (
              <div style={{ fontSize: 12, color: "#64748b" }}>표시할 청크가 없습니다.</div>
            )}
          </div>
          {selectedChunk && (
            <div style={{ border: "1px solid #dbe3f1", borderRadius: 10, background: "#fff", padding: 8, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#334155" }}>
                selected: {selectedChunk.meta.chunkId}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                boundary drag: 오버레이 상/하단 주황 핸들을 드래그해 경계를 조정하세요.
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                ai suggestion: {buildChunkSuggestion(selectedChunk.text, selectedChunk.meta.quality.tokens)}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={floatingButton}
                  onClick={() => {
                    setExcludedChunkIds((prev) => {
                      const next = new Set(prev);
                      next.add(selectedChunk.meta.chunkId);
                      return next;
                    });
                    fireAudit("exclude_chunk", { chunkId: selectedChunk.meta.chunkId });
                  }}
                >
                  exclude
                </button>
                <button
                  type="button"
                  style={floatingButton}
                  onClick={() => {
                    applyMergeWithNext(selectedChunk.meta.chunkId);
                    setReviewNotes((prev) => ({
                      ...prev,
                      [selectedChunk.meta.chunkId]:
                        (prev[selectedChunk.meta.chunkId] ?? "") + "\n[merge] applied with next chunk",
                    }));
                    fireAudit("merge_chunk", { chunkId: selectedChunk.meta.chunkId });
                  }}
                >
                  merge
                </button>
                <button
                  type="button"
                  style={floatingButton}
                  onClick={() => {
                    applySplitAtMidpoint(selectedChunk.meta.chunkId);
                    setReviewNotes((prev) => ({
                      ...prev,
                      [selectedChunk.meta.chunkId]:
                        (prev[selectedChunk.meta.chunkId] ?? "") + "\n[split] applied near sentence midpoint",
                    }));
                    fireAudit("split_chunk", { chunkId: selectedChunk.meta.chunkId });
                  }}
                >
                  split
                </button>
                <button type="button" style={floatingButton} onClick={() => void onReload()}>
                  save/reload
                </button>
              </div>
              <input
                value={editedLabels[selectedChunk.meta.chunkId] ?? selectedChunk.meta.sectionTitle ?? ""}
                onChange={(e) =>
                  setEditedLabels((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                placeholder="label edit"
                style={selector}
              />
              <textarea
                value={reviewNotes[selectedChunk.meta.chunkId] ?? ""}
                onChange={(e) =>
                  setReviewNotes((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                rows={3}
                placeholder="review note"
                style={{ ...selector, resize: "vertical" }}
              />
            </div>
          )}
        </div>
      </aside>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

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

const selector = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 8px",
  color: "#334155",
  width: "100%",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

