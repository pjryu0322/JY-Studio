"use client";

import Link from "next/link";
import EntryCard from "@/components/entry/EntryCard";
import ScreenLabel from "@/components/entry/ScreenLabel";

export default function AdminPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px 20px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ textAlign: "center", padding: "8px 0" }}>
          <ScreenLabel screen="관리자 운영 화면" mode="Manager" context="운영 도구" />
          <h1 style={{ margin: "10px 0 6px", fontSize: 30, color: "#102544", letterSpacing: "-0.02em" }}>
            Manager
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#5b667c" }}>
            관리자 작업을 선택하세요.
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
            description={["작업 상태 확인", "상세 작업 이동"]}
            href="/jobs"
            supportingText="작업 화면으로 이동"
          />
          <EntryCard
            variant="manager"
            title="실패 작업 확인"
            description={["오류 작업 검토", "재처리 동선 확인"]}
            href="/jobs"
            supportingText="작업 목록으로 이동"
          />
          <EntryCard
            variant="manager"
            title="템플릿 관리"
            description={["추천/적용/드리프트를 검토하고", "템플릿 운영 품질을 관리합니다."]}
            href="/templates/builder"
            supportingText="템플릿 빌더 열기"
          />
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
