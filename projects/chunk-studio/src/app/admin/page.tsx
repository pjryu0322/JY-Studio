"use client";

import Link from "next/link";
import EntryCard from "@/components/entry/EntryCard";
import ScreenLabel from "@/components/entry/ScreenLabel";
import { useRecentJobs } from "@/components/entry/useRecentJobs";

export default function AdminPage() {
  const { jobs, alerts } = useRecentJobs();
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const runningJobs = jobs.filter((job) => ["QUEUED", "CONVERTING", "EXTRACTING_TEXT", "CHUNKING"].includes(job.status));

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 100% 0%, rgba(79, 70, 229, 0.08) 0, transparent 30%), #f5f7fb",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <header
          style={{
            border: "1px solid rgba(87, 120, 255, 0.24)",
            borderRadius: 22,
            background: "linear-gradient(165deg, #ffffff 0%, #f6faff 100%)",
            padding: 22,
            boxShadow: "0 16px 30px rgba(17, 31, 64, 0.08)",
            textAlign: "center",
          }}
        >
          <ScreenLabel screen="관제 대시보드" mode="Manager" context="Manager Landing" />
          <h1 style={{ margin: "12px 0 6px", fontSize: 34, color: "#102544", letterSpacing: "-0.02em" }}>
            Manager
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#5b667c" }}>
            운영 상태를 모니터링하고 템플릿 관리를 진행하세요.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <EntryCard
            variant="manager"
            title="작업 현황 모니터링"
            description={[`진행 중 작업 ${runningJobs.length}건`, `확인 필요 ${alerts.actionRequired}건`]}
            href="/jobs"
            supportingText="작업 화면으로 이동"
          />
          <EntryCard
            variant="manager"
            title="실패 작업 확인"
            description={[`실패 작업 ${failedJobs.length}건`, "실패 원인을 검토하고 재처리합니다."]}
            href={failedJobs[0] ? `/jobs/${failedJobs[0].id}` : "/jobs"}
            supportingText={failedJobs[0] ? "최근 실패 작업으로 이동" : "작업 목록으로 이동"}
          />
          <EntryCard
            variant="manager"
            title="템플릿 관리"
            description={["추천/적용/드리프트를 검토하고", "템플릿 운영 품질을 관리합니다."]}
            href="/templates/builder"
            supportingText="템플릿 빌더 열기"
          />
        </section>

        <section
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 22,
            background: "#fff",
            boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
            padding: 16,
          }}
        >
          <strong style={{ fontSize: 14, color: "#122549" }}>시스템 알림 요약</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <AlertRow label="실패 작업" value={alerts.failed} color="#b91c1c" href="/jobs" />
            <AlertRow label="확인 필요" value={alerts.actionRequired} color="#c2410c" href="/jobs" />
            <AlertRow label="진행 중" value={alerts.running} color="#1d4ed8" href="/jobs" />
          </div>
        </section>

        <div style={{ textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 12, color: "#3156b9", textDecoration: "none" }}>
            역할 선택으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

function AlertRow({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: number;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="entry-row-link"
      style={{
        border: "1px solid rgba(148, 163, 184, 0.24)",
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        background: "#fcfdff",
      }}
    >
      <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
      <strong style={{ fontSize: 13, color }}>{value}</strong>
    </Link>
  );
}
