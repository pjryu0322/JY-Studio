"use client";

import { useRecentJobs } from "./useRecentJobs";

export default function RecentDocumentsPanel() {
  const { documents, loading } = useRecentJobs();
  const recent = documents.slice(0, 8);

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Recent Documents</h4>
      {loading && <div style={{ fontSize: 12, color: "#666" }}>Loading...</div>}
      {!loading && recent.length === 0 && (
        <div style={{ fontSize: 12, color: "#666" }}>No documents yet.</div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {recent.map((doc) => (
          <div
            key={doc.name}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
            title={doc.name}
          >
            <span
              style={{
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.name}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>jobs: {doc.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
