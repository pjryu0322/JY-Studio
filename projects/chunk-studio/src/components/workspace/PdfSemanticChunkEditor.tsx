"use client";

import { useRef } from "react";
import type { Job, JobDetailDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import ChunkInspector from "./ChunkInspector";
import PageAnalyzerPanel from "./PageAnalyzerPanel";
import { useWorkspaceState } from "./useWorkspaceState";
import WorkspacePdfPane from "./WorkspacePdfPane";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const state = useWorkspaceState({ selectedJob, detail });

  if (!selectedJob || !state.canPreviewPdf) {
    return (
      <section className="workspace-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center", display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 22, color: "#0f172a" }}>Drop PDF here</strong>
          <span style={{ fontSize: 13, color: "#64748b" }}>or click to upload</span>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={uploadButtonStyle}>
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
          <WorkspacePdfPane
            selectedJobId={selectedJob.id}
            viewportRef={scrollRef}
            fileInputRef={fileInputRef}
            state={state}
            loading={loading}
            error={error}
            onUpload={onUpload}
            onReload={onReload}
            inspector={
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  width: 360,
                  maxHeight: "calc(100% - 24px)",
                  overflowY: "auto",
                  zIndex: 40,
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #dbe3f1",
                  borderRadius: 12,
                  padding: 10,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                  display: state.inspectorOpen ? "block" : "none",
                }}
              >
                <ChunkInspector
                  visibleChunks={state.visibleChunks}
                  selectedChunk={state.selectedChunk}
                  editedLabels={state.editedLabels}
                  reviewNotes={state.reviewNotes}
                  suggestion={state.selectedChunkSuggestion}
                  onSelectChunk={state.selectChunk}
                  onFocusChunkInPdf={(chunk) => {
                    const mapped = mapChunkToPage(chunk);
                    if (mapped.pageStart) {
                      state.scrollToPage(mapped.pageStart, scrollRef.current);
                    }
                  }}
                  onExcludeSelected={state.excludeSelectedChunk}
                  onMergeSelected={state.mergeSelectedChunk}
                  onSplitSelected={state.splitSelectedChunk}
                  onReload={onReload}
                  onEditLabel={state.setChunkLabel}
                  onEditReviewNote={state.setChunkReviewNote}
                />
              </div>
            }
          />
        </div>

        <PageAnalyzerPanel
          familyHint={state.familyHint}
          pageProfiles={state.pageProfiles}
          currentPage={state.currentPage}
          onFamilyHintChange={state.setFamilyHint}
          onHoverPage={state.setHoveredAnalyzerPage}
          onSelectPage={(pageNumber) => state.scrollToPage(pageNumber, scrollRef.current)}
          onOverrideOrientation={state.onOverrideOrientation}
          onOverridePageType={state.onOverridePageType}
          onOverrideSubType={state.onOverrideSubType}
        />

      </div>
    </section>
  );
}

const uploadButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
} as const;
