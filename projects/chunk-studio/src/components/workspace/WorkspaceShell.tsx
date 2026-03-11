"use client";

import { useEffect } from "react";
import "./workspace.css";
import { useJobStore } from "@/store/jobStore";
import { useJobDetail } from "@/hooks/useJobDetail";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import TopBar from "./TopBar";
import StructurePanel from "./StructurePanel";
import PreviewPanel from "./PreviewPanel";
import ChunkReviewPanel from "./ChunkReviewPanel";

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
      <div className="workspace-shell__body">
        <PreviewPanel
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
          showLabels={showLabels}
        />
        <StructurePanel selectedJob={selectedJob} detail={detail} showLabels={showLabels} />
        <ChunkReviewPanel
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
