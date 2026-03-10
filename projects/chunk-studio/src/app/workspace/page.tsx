"use client";

import Link from "next/link";
import UploadPanel from "@/components/jobs/UploadPanel";
import RecentJobsPanel from "@/components/entry/RecentJobsPanel";
import RecentDocumentsPanel from "@/components/entry/RecentDocumentsPanel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

export default function WorkspacePage() {
  const { jobs } = useRecentJobs();
  const recentJob = jobs[0] ?? null;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 12 }}>
        <header style={{ border: "1px solid #ddd", borderRadius: 12, background: "#fff", padding: 14 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Operator Workspace</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
            Upload documents, continue recent jobs, and move into the chunking workbench.
          </p>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            {recentJob ? (
              <Link
                href={`/jobs/${recentJob.id}`}
                style={{
                  fontSize: 12,
                  border: "1px solid #1565c0",
                  color: "#1565c0",
                  borderRadius: 8,
                  padding: "6px 10px",
                  textDecoration: "none",
                }}
              >
                Continue Recent Job
              </Link>
            ) : (
              <span style={{ fontSize: 12, color: "#777" }}>No recent job yet.</span>
            )}
          </div>
        </header>

        <UploadPanel />

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <RecentJobsPanel />
          <RecentDocumentsPanel />
        </section>
      </div>
    </main>
  );
}
