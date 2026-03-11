"use client";

import { useEffect } from "react";
import "./workspace.css";
import { useJobStore } from "@/store/jobStore";
import { useJobDetail } from "@/hooks/useJobDetail";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import TopBar from "./TopBar";
import PdfChunkViewer from "./PdfChunkViewer";
import ChunkDetailPanel from "./ChunkDetailPanel";

export default function WorkspaceShell() {
  const refresh = useJobStore((s) => s.refresh);
  const { selectedJob, detail, loading, error } = useJobDetail();
  const { showLabels } = useWorkspacePreferences();

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <section className="workspace-shell" aria-label="Chunk Studio Workspace">
      <TopBar showLabels={showLabels} />
      <div className="workspace-shell__editor">
        <PdfChunkViewer
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
          showLabels={showLabels}
        />
        <ChunkDetailPanel
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
          showLabels={showLabels}
        />
      </div>
    </section>
  );
}
