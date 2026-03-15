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
            title="감사 로그 / 시스템 로그"
            description={["작업/분석/내보내기 로그 조회", "관리자 감사 추적"]}
            href="/admin/logs"
            supportingText="로그 화면으로 이동"
          />
          <EntryCard
            variant="manager"
            title="Page Classifier 점검"
            description={["문서 패밀리/페이지 타입 분류 점검", "워크스페이스 분석 결과 확인"]}
            href="/workspace"
            supportingText="작업공간으로 이동"
          />
          <EntryCard
            variant="manager"
            title="Export Policy"
            description={["RAG/Graph 내보내기 정책", "허용 포맷/메타데이터 정책 관리"]}
            href="/admin/policy"
            supportingText="정책 화면으로 이동"
          />
          <EntryCard
            variant="manager"
            title="Seed Dataset 관리"
            description={["문서 패밀리별 시드 데이터셋", "분류/학습 기반 데이터 관리"]}
            href="/admin/seeds"
            supportingText="시드 화면으로 이동"
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
