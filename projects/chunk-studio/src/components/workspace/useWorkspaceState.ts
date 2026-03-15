"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fireWorkspaceAudit } from "./AuditActionClient";
import {
  buildChunkSuggestion,
  mergeChunkWithNext,
  splitChunkAtMidpoint,
} from "./workspaceChunkEditing";

export type PdfViewMode = "continuous" | "single";

interface DragBoundaryState {
  chunkId: string;
  pageNumber: number;
  handle: "top" | "bottom";
  startClientY: number;
  startY: number;
  startH: number;
}

interface UseWorkspaceStateParams {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
}

export function useWorkspaceState({ selectedJob, detail }: UseWorkspaceStateParams) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfViewMode, setPdfViewMode] = useState<PdfViewMode>("single");
  const [freezeCurrentPage, setFreezeCurrentPage] = useState(false);
  const [firstPageSize, setFirstPageSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSizeByPage, setPageSizeByPage] = useState<Record<number, { width: number; height: number }>>({});
  const [familyHint, setFamilyHint] = useState<DocumentFamily>("guide_manual");
  const [recordByPage, setRecordByPage] = useState<Record<number, PageClassificationRecord>>({});
  const [hoveredAnalyzerPage, setHoveredAnalyzerPage] = useState<number | null>(null);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
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
  const [overlayAnchorByKey, setOverlayAnchorByKey] = useState<
    Record<string, { x: number; y: number; w: number; h: number }>
  >({});
  const [dragBoundary, setDragBoundary] = useState<DragBoundaryState | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const analyzedPageRef = useRef<Set<number>>(new Set());
  const wheelSwitchAtRef = useRef(0);

  const selectedJobId = selectedJob?.id ?? null;
  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const currentPageRecord = recordByPage[currentPage] ?? null;

  const renderWidth = useMemo(() => {
    const fallback = 420;
    if (!firstPageSize) return fallback;
    const pageSize = pdfViewMode === "single" ? pageSizeByPage[currentPage] ?? firstPageSize : firstPageSize;
    const pageWidth = Math.max(1, pageSize.width);
    return Math.max(120, Math.floor(pageWidth * zoom));
  }, [currentPage, firstPageSize, pageSizeByPage, pdfViewMode, zoom]);

  const zoomPercentLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

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

  const selectedChunkSuggestion = useMemo(() => {
    if (!selectedChunk) return "";
    return buildChunkSuggestion(selectedChunk.text, selectedChunk.meta.quality.tokens);
  }, [selectedChunk]);

  useEffect(() => {
    setCurrentPage(1);
    setZoom(1);
    setNumPages(0);
    setPageSizeByPage({});
    setRecordByPage({});
    setSelectedChunkId(null);
    setHoveredChunkId(null);
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

  const handlePageSize = useCallback((pageNumber: number, size: { width: number; height: number }) => {
    setPageSizeByPage((prev) => ({ ...prev, [pageNumber]: size }));
  }, []);

  const handlePageTextMap = useCallback(
    (pageNumber: number, blocks: Array<{ text: string; x: number; y: number; width: number; height: number; page: number }>) => {
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
            body: JSON.stringify({ pageNumber, pageSize, blocks, familyHint }),
          });
          if (!res.ok) return;
          const remote = (await res.json()) as PageClassificationRecord;
          setRecordByPage((prev) => ({ ...prev, [pageNumber]: remote }));
        } catch {
          // keep local classifier result
        }
      })();
    },
    [familyHint, firstPageSize, pageSizeByPage]
  );

  const handleViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
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
    },
    [numPages]
  );

  const updateCurrentPageFromViewport = useCallback(
    (viewport: HTMLDivElement) => {
      if (freezeCurrentPage) return;
      const pages = Array.from(viewport.querySelectorAll("[data-page-number]")) as Array<HTMLElement>;
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
    },
    [freezeCurrentPage]
  );

  const scrollToPage = useCallback(
    (pageNumber: number, viewport?: HTMLDivElement | null) => {
      if (pdfViewMode === "single") {
        setCurrentPage(pageNumber);
        return;
      }
      if (!viewport) return;
      const pageEl = viewport.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLElement | null;
      if (!pageEl) return;
      const targetTop = Math.max(0, pageEl.offsetTop - 8);
      viewport.scrollTo({ top: targetTop, behavior: "smooth" });
      setCurrentPage(pageNumber);
    },
    [pdfViewMode]
  );

  const nudgeZoom = useCallback(
    (delta: number) => {
      const pageSize = pdfViewMode === "single" ? pageSizeByPage[currentPage] ?? firstPageSize : firstPageSize;
      const basePageWidth = Math.max(1, pageSize?.width ?? firstPageSize?.width ?? 1);
      const currentScale = renderWidth / basePageWidth;
      const nextScale = clamp(Number((currentScale + delta).toFixed(2)), 0.2, 3);
      setZoom(nextScale);
    },
    [currentPage, firstPageSize, pageSizeByPage, pdfViewMode, renderWidth]
  );

  const startBoundaryDrag = useCallback(
    (
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
    },
    []
  );

  const selectChunk = useCallback((chunkId: string) => {
    setSelectedChunkId(chunkId);
    setInspectorOpen(true);
  }, []);

  const excludeSelectedChunk = useCallback(() => {
    if (!selectedChunk) return;
    setExcludedChunkIds((prev) => {
      const next = new Set(prev);
      next.add(selectedChunk.meta.chunkId);
      return next;
    });
    fireWorkspaceAudit(selectedJobId, "exclude_chunk", { chunkId: selectedChunk.meta.chunkId });
  }, [selectedChunk, selectedJobId]);

  const mergeSelectedChunk = useCallback(() => {
    if (!selectedChunk) return;
    const chunkId = selectedChunk.meta.chunkId;
    setLocalChunks((prev) => mergeChunkWithNext(prev, chunkId));
    setReviewNotes((prev) => ({
      ...prev,
      [chunkId]: (prev[chunkId] ?? "") + "\n[merge] applied with next chunk",
    }));
    fireWorkspaceAudit(selectedJobId, "merge_chunk", { chunkId });
  }, [selectedChunk, selectedJobId]);

  const splitSelectedChunk = useCallback(() => {
    if (!selectedChunk) return;
    const chunkId = selectedChunk.meta.chunkId;
    setLocalChunks((prev) => splitChunkAtMidpoint(prev, chunkId));
    setReviewNotes((prev) => ({
      ...prev,
      [chunkId]: (prev[chunkId] ?? "") + "\n[split] applied near sentence midpoint",
    }));
    fireWorkspaceAudit(selectedJobId, "split_chunk", { chunkId });
  }, [selectedChunk, selectedJobId]);

  const setChunkLabel = useCallback((chunkId: string, value: string) => {
    setEditedLabels((prev) => ({ ...prev, [chunkId]: value }));
  }, []);

  const setChunkReviewNote = useCallback((chunkId: string, value: string) => {
    setReviewNotes((prev) => ({ ...prev, [chunkId]: value }));
  }, []);

  const onOverrideOrientation = useCallback(
    (pageNumber: number, value: PageOrientation) => {
      const profile = pageProfiles.find((item) => item.pageNumber === pageNumber);
      if (!profile) return;
      setRecordByPage((prev) => ({
        ...prev,
        [pageNumber]: {
          ...profile,
          orientationFinal: value,
          userOverridden: true,
        },
      }));
    },
    [pageProfiles]
  );

  const onOverridePageType = useCallback(
    (pageNumber: number, value: PageType) => {
      const profile = pageProfiles.find((item) => item.pageNumber === pageNumber);
      if (!profile) return;
      setRecordByPage((prev) => ({
        ...prev,
        [pageNumber]: {
          ...profile,
          pageTypeFinal: value,
          userOverridden: true,
        },
      }));
    },
    [pageProfiles]
  );

  const onOverrideSubType = useCallback(
    (pageNumber: number, value: PageSubType) => {
      const profile = pageProfiles.find((item) => item.pageNumber === pageNumber);
      if (!profile) return;
      setRecordByPage((prev) => ({
        ...prev,
        [pageNumber]: {
          ...profile,
          subTypeFinal: value,
          userOverridden: true,
        },
      }));
    },
    [pageProfiles]
  );

  return {
    numPages,
    setNumPages,
    currentPage,
    setCurrentPage,
    pdfViewMode,
    setPdfViewMode,
    freezeCurrentPage,
    setFreezeCurrentPage,
    firstPageSize,
    setFirstPageSize,
    renderWidth,
    zoomPercentLabel,
    nudgeZoom,
    canPreviewPdf,
    pdfUnavailable,
    pdfAvailabilityChecked,
    previewFailureReason,
    setFailedPdfJobId,
    setPreviewFailureReason,
    settingsOpen,
    setSettingsOpen,
    familyHint,
    setFamilyHint,
    hoveredAnalyzerPage,
    setHoveredAnalyzerPage,
    hoveredChunkId,
    setHoveredChunkId,
    analysisHealth,
    currentPageRecord,
    pageProfiles,
    visibleChunks,
    selectedChunk,
    selectedChunkId,
    selectChunk,
    editedLabels,
    reviewNotes,
    selectedChunkSuggestion,
    overlayAnchorByKey,
    inspectorOpen,
    setInspectorOpen,
    handlePageSize,
    handlePageTextMap,
    handleViewportWheel,
    updateCurrentPageFromViewport,
    scrollToPage,
    startBoundaryDrag,
    excludeSelectedChunk,
    mergeSelectedChunk,
    splitSelectedChunk,
    setChunkLabel,
    setChunkReviewNote,
    onOverrideOrientation,
    onOverridePageType,
    onOverrideSubType,
  };
}

export type WorkspaceStateController = ReturnType<typeof useWorkspaceState>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
