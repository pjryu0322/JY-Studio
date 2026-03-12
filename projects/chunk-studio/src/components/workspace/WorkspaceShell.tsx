"use client";

import { useEffect } from "react";
import "./workspace.css";
import { useJobStore } from "@/store/jobStore";
import { useJobDetail } from "@/hooks/useJobDetail";
import PdfSemanticChunkEditor from "./PdfSemanticChunkEditor";

export default function WorkspaceShell() {
  const refresh = useJobStore((s) => s.refresh);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
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
      <PdfSemanticChunkEditor
        selectedJob={selectedJob}
        detail={detail}
        loading={loading}
        error={error}
        onUpload={async (file) => {
          if (!file) return;
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/jobs", { method: "POST", body: formData });
          const payload = (await res.json().catch(() => ({}))) as { jobId?: string };
          if (payload.jobId) setSelectedJobId(payload.jobId);
          await refresh();
        }}
        onReload={async () => {
          await refresh();
        }}
      />
    </section>
  );
}
