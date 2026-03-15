"use client";

import { useRef } from "react";
import type { Job, JobDetailDTO } from "@/types/job";
import PageAnalyzerPanel from "./PageAnalyzerPanel";
import { useWorkspaceState } from "./useWorkspaceState";
import WorkspaceEmptyState from "./WorkspaceEmptyState";
import WorkspaceInspectorDock from "./WorkspaceInspectorDock";
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
      <WorkspaceEmptyState
        fileInputRef={fileInputRef}
        onUpload={onUpload}
      />
    );
  }

  return (
    <section
      className="workspace-shell"
      style={{ height: "100vh", overflow: "hidden" }}
    >
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
              <WorkspaceInspectorDock
                state={state}
                viewportRef={scrollRef}
                onReload={onReload}
              />
            }
          />
        </div>

        <PageAnalyzerPanel
          familyHint={state.familyHint}
          pageProfiles={state.pageProfiles}
          currentPage={state.selectedPage}
          onFamilyHintChange={state.setFamilyHint}
          onHoverPage={state.setHoveredAnalyzerPage}
          onSelectPage={(pageNumber) =>
            state.scrollToPage(pageNumber, scrollRef.current)
          }
          onOverrideOrientation={state.onOverrideOrientation}
          onOverridePageType={state.onOverridePageType}
          onOverrideSubType={state.onOverrideSubType}
        />
      </div>
    </section>
  );
}
