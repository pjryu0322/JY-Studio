"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SystemAlertsPanel from "@/components/entry/SystemAlertsPanel";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

function AdminPageInner() {
  const params = useSearchParams();
  const view = params.get("view");
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const { jobs, loading } = useRecentJobs();
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const actionRequiredJobs = jobs.filter((job) => job.status === "ACTION_REQUIRED");
  const runningJobs = jobs.filter((job) => ["QUEUED", "CONVERTING", "EXTRACTING_TEXT", "CHUNKING"].includes(job.status));
  const focusJobs =
    ids.length > 0 ? jobs.filter((job) => ids.includes(job.id)) : [];
  const visibleFocusJobs =
    view === "failed"
      ? failedJobs
      : view === "actionRequired"
        ? actionRequiredJobs
        : view === "running"
          ? runningJobs
          : focusJobs;

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
          <ScreenLabel screen="관제 대시보드" mode="Manager" context="모니터링 및 운영 관리" />
          <div style={{ fontSize: 11, color: "#274c96", fontWeight: 700, marginBottom: 6 }}>
            MANAGER 모드
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, color: "#122549" }}>Manager 관제 대시보드</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#56627b" }}>
            파이프라인 상태와 장애를 점검하고 템플릿 운영 흐름을 관리합니다.
          </p>
        </header>

        {view && (
          <section
            style={{
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 14,
              background: "#fff",
              padding: 12,
              boxShadow: "0 8px 20px rgba(17, 31, 64, 0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: "#102544" }}>
                🔎 필터 보기: {view === "failed" ? "실패 작업" : view === "actionRequired" ? "조치 필요" : "진행 중"}
              </h4>
              <Link href="/admin" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
                필터 해제
              </Link>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {visibleFocusJobs.slice(0, 10).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "7px 9px",
                    fontSize: 12,
                    textDecoration: "none",
                    color: "#334155",
                    background: "#f8fbff",
                  }}
                >
                  {job.originalFilename ?? job.id} - {job.status}
                </Link>
              ))}
              {visibleFocusJobs.length === 0 && (
                <div style={{ fontSize: 12, color: "#64748b" }}>해당 조건의 작업이 없습니다.</div>
              )}
            </div>
          </section>
        )}

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section style={{ border: "1px solid rgba(87, 120, 255, 0.2)", borderRadius: 16, background: "#fff", padding: 14, boxShadow: "0 10px 24px rgba(25, 36, 67, 0.06)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15, color: "#132547" }}>📊 작업 모니터링</h4>
            <div style={{ fontSize: 12, color: "#555" }}>
              진행 중 작업: <strong>{loading ? "..." : runningJobs.length}</strong>
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {runningJobs.slice(0, 8).map((job) => (
                <div key={job.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}>
                  <div style={{ color: "#333" }}>{job.originalFilename ?? job.id}</div>
                  <div style={{ color: "#666", marginTop: 2 }}>{job.status}</div>
                </div>
              ))}
              {runningJobs.length === 0 && (
                <div style={{ fontSize: 12, color: "#777" }}>진행 중인 작업이 없습니다.</div>
              )}
            </div>
          </section>

          <section style={{ border: "1px solid rgba(242, 101, 101, 0.28)", borderRadius: 16, background: "#fff", padding: 14, boxShadow: "0 10px 24px rgba(80, 26, 26, 0.06)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15, color: "#991b1b" }}>⚠️ 실패 작업</h4>
            <div style={{ display: "grid", gap: 6 }}>
              {failedJobs.slice(0, 10).map((job) => (
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
                <div style={{ fontSize: 12, color: "#777" }}>실패 작업이 없습니다.</div>
              )}
            </div>
          </section>
        </section>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section style={{ border: "1px solid rgba(87, 120, 255, 0.2)", borderRadius: 16, background: "#fff", padding: 14, boxShadow: "0 10px 24px rgba(25, 36, 67, 0.06)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15, color: "#132547" }}>🧭 템플릿 관리</h4>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              템플릿 추천/운영/드리프트 점검 흐름을 템플릿 빌더에서 관리합니다.
            </p>
            <Link
              href="/templates/builder"
              style={{
                display: "inline-block",
                marginTop: 10,
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
              템플릿 빌더 열기
            </Link>
          </section>

          <section style={{ border: "1px solid rgba(87, 120, 255, 0.2)", borderRadius: 16, background: "#fff", padding: 14, boxShadow: "0 10px 24px rgba(25, 36, 67, 0.06)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15, color: "#132547" }}>🧪 드리프트 상태</h4>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              템플릿/문서별 드리프트 점검은 Builder의 Drift 탭에서 확인할 수 있습니다.
            </p>
          </section>
        </section>

        <SystemAlertsPanel />
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", padding: 20 }}>관리 대시보드 불러오는 중...</main>}>
      <AdminPageInner />
    </Suspense>
  );
}
