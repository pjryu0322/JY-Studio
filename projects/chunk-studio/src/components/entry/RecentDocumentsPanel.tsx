"use client";

import Link from "next/link";
import { useRecentJobs } from "./useRecentJobs";

export default function RecentDocumentsPanel() {
  const { documents, loading } = useRecentJobs();
  const recent = documents.slice(0, 8);

  return (
    <section
      style={{
        border: "1px solid rgba(87, 120, 255, 0.2)",
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        boxShadow: "0 10px 24px rgba(25, 36, 67, 0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 15, color: "#132547" }}>📄 최근 문서</h4>
        <Link href="/workspace" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
          전체 보기
        </Link>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>최근 업로드 기준</div>
      {loading && (
        <div style={{ display: "grid", gap: 6 }}>
          {Array.from({ length: 3 }, (_, idx) => (
            <div
              key={`docs-loading-${idx}`}
              style={{
                height: 36,
                borderRadius: 8,
                border: "1px solid #eef2ff",
                background: "linear-gradient(90deg, #f8fbff 0%, #edf3ff 50%, #f8fbff 100%)",
              }}
            />
          ))}
        </div>
      )}
      {!loading && recent.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: "#667085",
            border: "1px dashed #d6deee",
            borderRadius: 8,
            padding: 10,
            background: "#fbfcff",
          }}
        >
          최근 문서가 없습니다.
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {recent.map((doc) => (
          <Link
            key={doc.name}
            href={doc.recentJobId ? `/jobs/${doc.recentJobId}` : "/workspace"}
            className="entry-row-link"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              background: "#fcfdff",
              transition: "all 120ms ease",
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
            <span style={{ fontSize: 11, color: "#666" }}>작업 {doc.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
