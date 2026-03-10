"use client";

import JobDetail from "@/components/jobs/JobDetail";

export default function ChunkPanel() {
  return (
    <section className="chunk-panel">
      <div className="chunk-panel__header">
        <strong>Chunk Review Panel</strong>
        <span style={{ color: "#666" }}>
          boundaries / metadata / diff / export
        </span>
      </div>
      <div className="chunk-panel__body">
        <JobDetail />
      </div>
    </section>
  );
}
