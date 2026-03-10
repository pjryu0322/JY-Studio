"use client";

import { useJobStore } from "@/store/jobStore";
import type { Job, JobStatus } from "@/types/job";

function StatusBadge({ status }: { status: JobStatus }) {
  const style: Record<JobStatus, React.CSSProperties> = {
    UPLOADED: { background: "#e3f2fd", color: "#1565c0" },
    ACTION_REQUIRED: { background: "#fff3e0", color: "#e65100" },
    QUEUED: { background: "#e8f5e9", color: "#2e7d32" },
    CONVERTING: { background: "#e3f2fd", color: "#1565c0" },
    PDF_READY: { background: "#e8f5e9", color: "#2e7d32" },
    EXTRACTING_TEXT: { background: "#e3f2fd", color: "#1565c0" },
    CHUNKING: { background: "#e3f2fd", color: "#1565c0" },
    DONE: { background: "#e8f5e9", color: "#1b5e20" },
    FAILED: { background: "#ffebee", color: "#c62828" },
  };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        ...style[status],
      }}
    >
      {status}
    </span>
  );
}

export default function JobList() {
  const { jobs, selectedJobId, setSelectedJobId, refresh } = useJobStore();

  const handleSelect = (job: Job) => {
    setSelectedJobId(job.id);
  };

  return (
    <div style={{ padding: 16, borderRight: "1px solid #ddd", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Jobs</h2>
        <button
          type="button"
          onClick={refresh}
          style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: "100%",
          overflowY: "auto",
        }}
      >
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            selected={job.id === selectedJobId}
            onSelect={() => handleSelect(job)}
          />
        ))}
      </ul>
      {jobs.length === 0 && (
        <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>No jobs yet. Upload a file to get started.</p>
      )}
    </div>
  );
}

function JobRow({ job, selected, onSelect }: { job: Job; selected: boolean; onSelect: () => void }) {
  const created = new Date(job.createdAt);
  const createdLabel = isNaN(created.getTime()) ? "" : created.toLocaleString();

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: "100%",
          textAlign: "left",
          borderRadius: 6,
          border: "1px solid " + (selected ? "#1565c0" : "#ddd"),
          padding: 10,
          background: selected ? "#e3f2fd" : "#fff",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#222",
              marginRight: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={job.originalFilename ?? job.id}
          >
            {job.originalFilename ?? job.id}
          </span>
          <StatusBadge status={job.status} />
        </div>
        {createdLabel && (
          <div style={{ fontSize: 11, color: "#666" }}>{createdLabel}</div>
        )}
        {job.message && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#555" }}>{job.message}</div>
        )}
      </button>
    </li>
  );
}
