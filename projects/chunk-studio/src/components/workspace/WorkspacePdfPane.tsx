"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { RefObject, ReactNode } from "react";
import type { WorkspaceStateController } from "./useWorkspaceState";
import ChunkOverlayCanvas from "./ChunkOverlayCanvas";

const PdfPreviewClient = dynamic(() => import("@/components/templates/PdfPreviewClient"), { ssr: false });

interface WorkspacePdfPaneProps {
  selectedJobId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  state: WorkspaceStateController;
  loading: boolean;
  error: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onReload: () => Promise<void>;
  inspector: ReactNode;
}

export default function WorkspacePdfPane({
  selectedJobId,
  viewportRef,
  fileInputRef,
  state,
  loading,
  error,
  onUpload,
  onReload,
  inspector,
}: WorkspacePdfPaneProps) {
  return (
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
        ref={viewportRef}
        onScroll={(event) => state.updateCurrentPageFromViewport(event.currentTarget)}
        onWheelCapture={state.pdfViewMode === "single" ? state.handleViewportWheel : undefined}
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
        {state.canPreviewPdf && !state.pdfUnavailable && state.pdfAvailabilityChecked ? (
          <PdfPreviewClient
            key={selectedJobId}
            fileUrl={`/api/jobs/${selectedJobId}/pdf`}
            width={state.renderWidth}
            viewMode={state.pdfViewMode}
            focusedPage={state.currentPage}
            onFirstPageSize={state.setFirstPageSize}
            onPageSize={state.handlePageSize}
            onPageTextMap={state.handlePageTextMap}
            renderOverlay={(pageNumber) => (
              <ChunkOverlayCanvas
                pageNumber={pageNumber}
                visibleChunks={state.visibleChunks}
                selectedChunkId={state.selectedChunkId}
                hoveredAnalyzerPage={state.hoveredAnalyzerPage}
                overlayAnchorByKey={state.overlayAnchorByKey}
                onSelectChunk={state.selectChunk}
                onStartBoundaryDrag={state.startBoundaryDrag}
              />
            )}
            onLoadSuccess={state.setNumPages}
            onLoadError={() => {
              state.setFailedPdfJobId(selectedJobId);
              state.setPreviewFailureReason("원본 PDF 렌더링에 실패했습니다.");
            }}
          />
        ) : state.canPreviewPdf && !state.pdfAvailabilityChecked ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>PDF 미리보기 가능 여부를 확인 중입니다.</div>
        ) : (
          <div style={errorOverlay}>
            <div style={{ fontWeight: 700 }}>PDF 미리보기를 불러오지 못했습니다.</div>
            <div>{state.previewFailureReason ?? "원본 PDF 렌더링에 실패했습니다."}</div>
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
          onMouseEnter={() => state.setFreezeCurrentPage(true)}
          onMouseLeave={() => state.setFreezeCurrentPage(false)}
        >
          <button type="button" style={floatingButton} onClick={() => state.nudgeZoom(0.1)}>
            +
          </button>
          <button type="button" style={floatingButton} onClick={() => state.nudgeZoom(-0.1)}>
            -
          </button>
          <div style={{ ...floatingButton, cursor: "default", background: "#f8fafc", color: "#334155" }}>
            {state.zoomPercentLabel}
          </div>
          <button
            type="button"
            style={{
              ...floatingButton,
              background: state.pdfViewMode === "continuous" ? "#e0e7ff" : "#fff",
              color: state.pdfViewMode === "continuous" ? "#3730a3" : "#0f172a",
            }}
            onClick={() => state.setPdfViewMode("continuous")}
          >
            전체 스크롤
          </button>
          <button
            type="button"
            style={{
              ...floatingButton,
              background: state.pdfViewMode === "single" ? "#e0e7ff" : "#fff",
              color: state.pdfViewMode === "single" ? "#3730a3" : "#0f172a",
            }}
            onClick={() => state.setPdfViewMode("single")}
          >
            페이지 단위
          </button>
          <div style={{ ...floatingButton, cursor: "default", background: "#f8fafc", color: "#334155" }}>
            page {state.currentPage}/{Math.max(1, state.numPages)}
          </div>
        </div>

        {state.currentPageRecord && (
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
              blocks {state.currentPageRecord.features.textBlockCount} / avgLen{" "}
              {Math.round(state.currentPageRecord.features.averageLineLength)}
            </div>
            <div>
              score c:{state.currentPageRecord.scores.coverScore.toFixed(2)} t:
              {state.currentPageRecord.scores.tocScore.toFixed(2)} tb:
              {state.currentPageRecord.scores.tableScore.toFixed(2)} b:
              {state.currentPageRecord.scores.bodyScore.toFixed(2)} r:
              {state.currentPageRecord.scores.revisionScore.toFixed(2)}
            </div>
          </div>
        )}

        <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 50 }}>
          <button type="button" style={floatingButton} onClick={() => state.setSettingsOpen((v) => !v)}>
            ⚙
          </button>
          {state.settingsOpen && (
            <div
              style={{
                marginTop: 8,
                background: "#fff",
                border: "1px solid #dbe3f1",
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gap: 6,
                minWidth: 180,
              }}
            >
              <button type="button" style={menuBtn} onClick={() => fileInputRef.current?.click()}>
                Upload PDF
              </button>
              <button type="button" style={menuBtn} onClick={() => void onReload()}>
                Reload document
              </button>
              <Link href="/workspace/settings" style={menuLink}>
                Workspace settings
              </Link>
              <Link href="/jobs" style={menuLink}>
                Job list
              </Link>
              {loading && <div style={{ fontSize: 11, color: "#64748b" }}>문서를 분석 중입니다.</div>}
              {error && <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div>}
              <div style={{ fontSize: 11, color: "#64748b" }}>Pages: {state.numPages || "-"}</div>
              {state.analysisHealth && (
                <div
                  style={{
                    fontSize: 11,
                    color: state.analysisHealth.available ? "#166534" : "#b91c1c",
                    border: "1px solid #dbe3f1",
                    borderRadius: 7,
                    padding: "6px 8px",
                    background: "#f8fafc",
                  }}
                >
                  Analysis: {state.analysisHealth.mode} / {state.analysisHealth.available ? "ok" : "degraded"}
                  <div style={{ marginTop: 2, color: "#64748b" }}>{state.analysisHealth.message}</div>
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
      {inspector}
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
