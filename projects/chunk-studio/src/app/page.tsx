"use client";

import EntryCard from "@/components/entry/EntryCard";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(73, 127, 255, 0.1) 0, transparent 28%), radial-gradient(circle at 100% 0%, rgba(45, 212, 191, 0.08) 0, transparent 22%), #f5f7fb",
        padding: "28px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          minHeight: "calc(100vh - 120px)",
          display: "grid",
          alignContent: "center",
          gap: 20,
        }}
      >
        <header
          style={{
            padding: "6px 0",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: "6px 0 8px",
              fontSize: 42,
              color: "#102544",
              letterSpacing: "-0.02em",
            }}
          >
            Chunk Studio
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: "#334155", fontWeight: 600 }}>
            Document Chunking Workbench
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
            문서 구조 분석 · 의미 기반 청킹 · RAG 준비
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          }}
        >
          <EntryCard
            variant="operator"
            title="Operator"
            description={["문서 업로드", "청킹 작업 수행", "구조 / 미리보기 / 청크 검토"]}
            href="/workspace"
            supportingText="작업공간으로 이동"
          />
          <EntryCard
            variant="manager"
            title="Manager"
            description={["작업 현황 모니터링", "실패 작업 확인", "템플릿 관리"]}
            href="/admin"
            supportingText="관리 화면으로 이동"
          />
        </section>
      </div>
    </main>
  );
}
