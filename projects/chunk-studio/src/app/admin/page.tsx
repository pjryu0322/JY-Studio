"use client";

import Link from "next/link";
import SystemAlertsPanel from "@/components/entry/SystemAlertsPanel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

export default function AdminPage() {
  const { jobs } = useRecentJobs();
  const failedJobs = jobs.filter((job) => job.status === "FAILED").slice(0, 10);
  const runningJobs = jobs.filter((job) =>
    ["QUEUED", "CONVERTING", "EXTRACTING_TEXT", "CHUNKING"].includes(job.status)
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 12 }}>
        <header style={{ border: "1px solid #ddd", borderRadius: 12, background: "#fff", padding: 14 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Manager Dashboard</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
            Monitor pipeline health, inspect failed jobs, and manage template workflows.
          </p>
        </header>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Job Monitoring</h4>
            <div style={{ fontSize: 12, color: "#555" }}>
              running jobs: <strong>{runningJobs.length}</strong>
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {runningJobs.slice(0, 8).map((job) => (
                <div key={job.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}>
                  <div style={{ color: "#333" }}>{job.originalFilename ?? job.id}</div>
                  <div style={{ color: "#666", marginTop: 2 }}>{job.status}</div>
                </div>
              ))}
              {runningJobs.length === 0 && (
                <div style={{ fontSize: 12, color: "#777" }}>No running jobs.</div>
              )}
            </div>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Failed Jobs</h4>
            <div style={{ display: "grid", gap: 6 }}>
              {failedJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  style={{
                    border: "1px solid #ffebee",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 12,
                    color: "#b71c1c",
                    textDecoration: "none",
                  }}
                >
                  {job.originalFilename ?? job.id}
                </Link>
              ))}
              {failedJobs.length === 0 && (
                <div style={{ fontSize: 12, color: "#777" }}>No failed jobs.</div>
              )}
            </div>
          </section>
        </section>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Template Management</h4>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Manage templates, recommendations, and drift checks from the template builder.
            </p>
            <Link
              href="/templates/builder"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                border: "1px solid #1565c0",
                color: "#1565c0",
                borderRadius: 8,
                padding: "6px 10px",
                textDecoration: "none",
              }}
            >
              Open Template Builder
            </Link>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Template Drift Status</h4>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Drift checks are available per template/job inside the builder Drift tab.
            </p>
          </section>
        </section>

        <SystemAlertsPanel />
      </div>
    </main>
  );
}
