"use client";

import Link from "next/link";
import { useRecentJobs } from "./useRecentJobs";

export default function RecentJobsPanel() {
  const { jobs, loading } = useRecentJobs();
  const recent = jobs.slice(0, 8);

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
        <h4 style={{ margin: 0, fontSize: 15, color: "#132547" }}>🧩 최근 작업</h4>
        <Link href="/jobs" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
          전체 보기
        </Link>
      </div>
      {loading && (
        <div style={{ display: "grid", gap: 6 }}>
          {Array.from({ length: 3 }, (_, idx) => (
            <div
              key={`jobs-loading-${idx}`}
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
          아직 작업 이력이 없습니다. 워크스페이스에서 문서를 업로드해 시작하세요.
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {recent.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="entry-row-link"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              border: "1px solid #eee",
              borderRadius: 8,
              padding: "8px 10px",
              textDecoration: "none",
              color: "inherit",
              background: "#fcfdff",
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
            <span
              style={{
                fontSize: 11,
                color:
                  job.status === "FAILED"
                    ? "#b71c1c"
                    : job.status === "ACTION_REQUIRED"
                      ? "#ef6c00"
                      : "#35548e",
                fontWeight: 600,
              }}
            >
              {job.status === "ACTION_REQUIRED" ? "확인 필요" : job.status}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
