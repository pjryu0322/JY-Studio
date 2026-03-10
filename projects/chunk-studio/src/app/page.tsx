"use client";

import EntryCard from "@/components/entry/EntryCard";
import RecentJobsPanel from "@/components/entry/RecentJobsPanel";
import RecentDocumentsPanel from "@/components/entry/RecentDocumentsPanel";
import SystemAlertsPanel from "@/components/entry/SystemAlertsPanel";
import KpiChip from "@/components/entry/KpiChip";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";
import Link from "next/link";

export default function Home() {
  const { alerts, documents, jobs, loading } = useRecentJobs();
  const recentJob = jobs[0] ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(73, 127, 255, 0.12) 0, transparent 28%), radial-gradient(circle at 100% 0%, rgba(45, 212, 191, 0.11) 0, transparent 22%), #f5f7fb",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 16 }}>
        <header
          style={{
            border: "1px solid rgba(90, 123, 214, 0.25)",
            borderRadius: 20,
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(247,251,255,0.98) 48%, rgba(238,246,255,0.98) 100%)",
            padding: 20,
            boxShadow: "0 20px 42px rgba(17, 31, 64, 0.08)",
          }}
        >
          <ScreenLabel screen="진입 허브" context="역할 선택" />
          <div
            style={{
              fontSize: 11,
              color: "#274c96",
              fontWeight: 700,
              display: "inline-block",
              borderRadius: 999,
              padding: "4px 10px",
              background: "rgba(70, 120, 255, 0.12)",
              border: "1px solid rgba(70, 120, 255, 0.2)",
              marginTop: 10,
              marginBottom: 10,
            }}
          >
            Chunk Studio 진입 허브
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 34, color: "#102544", letterSpacing: "-0.02em" }}>
            Chunk Studio
          </h1>
          <p style={{ margin: 0, maxWidth: 920, fontSize: 14, color: "#56627b", lineHeight: 1.6 }}>
            문서 구조를 시각적으로 검토하고, 의미 기반 청크 품질을 확인한 뒤, RAG 검색에 바로 쓸 수 있는
            결과로 내보내는 청킹 워크벤치입니다.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <KpiChip label="진행 중" value={loading ? "..." : String(alerts.running)} tone="info" />
            <KpiChip label="실패" value={loading ? "..." : String(alerts.failed)} tone="danger" />
            <KpiChip label="최근 문서" value={loading ? "..." : String(documents.length)} tone="neutral" />
            <KpiChip label="조치 필요" value={loading ? "..." : String(alerts.actionRequired)} tone="warning" />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/workspace"
              style={{
                textDecoration: "none",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg, #2b64f3, #1f4ed8)",
                border: "1px solid #2459d9",
                padding: "9px 14px",
                boxShadow: "0 10px 20px rgba(40, 88, 220, 0.24)",
              }}
            >
              문서 작업 시작
            </Link>
            <Link
              href="/admin"
              style={{
                textDecoration: "none",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                color: "#2f4267",
                background: "#fff",
                border: "1px solid rgba(65, 84, 120, 0.24)",
                padding: "9px 14px",
              }}
            >
              관리 화면 열기
            </Link>
          </div>
        </header>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <EntryCard
            icon="🛠️"
            variant="operator"
            badge="실행 모드"
            title="Operator"
            description="업로드 -> 청킹 실행 -> 구조/미리보기/청크 검토 -> Diff 확인 -> RAG 내보내기까지 한 번에 처리합니다."
            actions={[
              { label: "새 문서 업로드", href: "/workspace#upload-entry", emphasis: "primary" },
              { label: "최근 작업 이어가기", href: recentJob ? `/jobs/${recentJob.id}` : "/jobs" },
            ]}
            indicators={[
              { label: "진행", value: String(alerts.running) },
              { label: "확인", value: String(alerts.actionRequired) },
              { label: "실패", value: String(alerts.failed) },
            ]}
          />
          <EntryCard
            icon="🧭"
            variant="manager"
            badge="관제 모드"
            title="Manager"
            description="파이프라인 상태/실패를 관제하고, 템플릿 추천/드리프트와 운영 알림을 점검합니다."
            actions={[
              { label: "작업 현황 보기", href: "/admin?view=running", emphasis: "primary" },
              { label: "템플릿 관리", href: "/templates/builder" },
            ]}
            indicators={[
              { label: "실패 작업", value: String(alerts.failed) },
              { label: "최근 문서", value: String(documents.length) },
              { label: "진행 작업", value: String(alerts.running) },
            ]}
          />
        </section>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <RecentJobsPanel />
          <RecentDocumentsPanel />
          <SystemAlertsPanel />
        </section>
      </div>
    </main>
  );
}
