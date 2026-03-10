"use client";

import Link from "next/link";
import { useRecentJobs } from "./useRecentJobs";

export default function RecentJobsPanel() {
  const { jobs, loading } = useRecentJobs();
  const recent = jobs.slice(0, 8);

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Recent Jobs</h4>
      {loading && <div style={{ fontSize: 12, color: "#666" }}>Loading...</div>}
      {!loading && recent.length === 0 && (
        <div style={{ fontSize: 12, color: "#666" }}>No jobs yet.</div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {recent.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              border: "1px solid #eee",
              borderRadius: 8,
              padding: "8px 10px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {job.originalFilename ?? job.id}
            </span>
            <span style={{ fontSize: 11, color: "#555" }}>{job.status}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
