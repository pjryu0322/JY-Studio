"use client";

import Link from "next/link";
import UploadPanel from "@/components/jobs/UploadPanel";
import RecentJobsPanel from "@/components/entry/RecentJobsPanel";
import RecentDocumentsPanel from "@/components/entry/RecentDocumentsPanel";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

export default function WorkspacePage() {
  const { jobs, loading } = useRecentJobs();
  const recentJob = jobs[0] ?? null;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: 20 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 12 }}>
        <header
          style={{
            border: "1px solid rgba(87, 120, 255, 0.24)",
            borderRadius: 18,
            background: "linear-gradient(165deg, #ffffff 0%, #f6faff 100%)",
            padding: 16,
            boxShadow: "0 14px 30px rgba(17, 31, 64, 0.08)",
          }}
        >
          <ScreenLabel screen="작업공간" mode="Operator" context="문서 업로드 및 작업 재개" />
          <div style={{ fontSize: 11, color: "#274c96", fontWeight: 700, marginBottom: 6 }}>
            OPERATOR 모드
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, color: "#122549" }}>Operator 작업공간</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#56627b" }}>
            문서를 업로드하고 최근 작업을 이어서 청킹 워크벤치로 진입합니다.
          </p>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/jobs"
              style={{
                fontSize: 12,
                border: "1px solid rgba(65, 84, 120, 0.24)",
                color: "#2f4267",
                background: "#fff",
                borderRadius: 10,
                padding: "7px 11px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              작업 목록 보기
            </Link>
            {loading ? (
              <span style={{ fontSize: 12, color: "#777" }}>최근 작업 불러오는 중...</span>
            ) : recentJob ? (
              <Link
                href={`/jobs/${recentJob.id}`}
                style={{
                  fontSize: 12,
                  border: "1px solid #2459d9",
                  color: "#fff",
                  background: "linear-gradient(135deg, #2b64f3, #1f4ed8)",
                  borderRadius: 10,
                  padding: "7px 11px",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                최근 작업 계속하기
              </Link>
            ) : (
              <span style={{ fontSize: 12, color: "#777" }}>최근 작업이 없습니다.</span>
            )}
          </div>
        </header>

        <div id="upload-entry">
          <UploadPanel />
        </div>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <RecentJobsPanel />
          <RecentDocumentsPanel />
        </section>
      </div>
    </main>
  );
}
