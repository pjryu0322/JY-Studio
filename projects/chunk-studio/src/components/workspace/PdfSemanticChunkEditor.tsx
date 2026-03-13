"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import type { Job } from "@/types/job";
import {
  classifyPageType,
  type ClassifiedPageResult,
  type PageLayoutProfile,
  type PageTypeScores,
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
  loading: boolean;
  error: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onReload: () => Promise<void>;
}

export default function PdfSemanticChunkEditor({
  selectedJob,
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
  const [pageTypeByPage, setPageTypeByPage] = useState<Record<number, PageType>>({});
  const [pageProfileByPage, setPageProfileByPage] = useState<Record<number, PageLayoutProfile>>({});
  const [pageScoresByPage, setPageScoresByPage] = useState<Record<number, PageTypeScores>>({});
  const [pageTypeOverrideByPage, setPageTypeOverrideByPage] = useState<Record<number, PageType | null>>(
    {}
  );
  const [hoveredAnalyzerPage, setHoveredAnalyzerPage] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wheelSwitchAtRef = useRef(0);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const selectedJobId = selectedJob?.id ?? null;
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const currentPageProfile = pageProfileByPage[currentPage] ?? null;
  const currentPageScores = pageScoresByPage[currentPage] ?? null;
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


  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    setCurrentPage(1);
    setZoom(1);
    setPageSizeByPage({});
    setPageTypeByPage({});
    setPageProfileByPage({});
    setPageScoresByPage({});
    setPageTypeOverrideByPage({});
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
              const classified: ClassifiedPageResult = classifyPageType(blocks, pageNumber);
              setPageTypeByPage((prev) => ({ ...prev, [pageNumber]: classified.pageType }));
              setPageProfileByPage((prev) => ({ ...prev, [pageNumber]: classified.profile }));
              setPageScoresByPage((prev) => ({ ...prev, [pageNumber]: classified.scores }));
            }}
            renderOverlay={(pageNumber) =>
              hoveredAnalyzerPage === pageNumber ? (
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
              ) : null
            }
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
          <div style={{ fontSize: 12, color: "#334155" }}>
            오버레이 기능이 비활성화되었습니다.
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
