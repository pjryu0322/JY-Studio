"use client";

import { useEffect } from "react";
import "./workspace.css";
import { useJobStore } from "@/store/jobStore";
import { useJobDetail } from "@/hooks/useJobDetail";
import TopBar from "./TopBar";
import StructurePanel from "./StructurePanel";
import PreviewPanel from "./PreviewPanel";
import ChunkReviewPanel from "./ChunkReviewPanel";

export default function WorkspaceShell() {
  const refresh = useJobStore((s) => s.refresh);
  const { selectedJob, detail, loading, error } = useJobDetail();

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <section className="workspace-shell" aria-label="Chunk Studio Workspace">
      <TopBar />
      <div className="workspace-shell__body">
        <StructurePanel selectedJob={selectedJob} detail={detail} />
        <PreviewPanel selectedJob={selectedJob} detail={detail} loading={loading} error={error} />
        <ChunkReviewPanel
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}
