"use client";

import EntryCard from "@/components/entry/EntryCard";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          minHeight: "calc(100vh - 100px)",
          display: "grid",
          alignContent: "center",
          gap: 16,
        }}
      >
        <header style={{ padding: "6px 0", textAlign: "center" }}>
          <h1
            style={{
              margin: "6px 0 8px",
              fontSize: 38,
              color: "#102544",
              letterSpacing: "-0.02em",
            }}
          >
            Chunk Studio
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            역할을 선택해 작업을 시작하세요.
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
            description={["작업 현황 모니터링", "실패 작업 확인", "운영 점검"]}
            href="/admin"
            supportingText="관리 화면으로 이동"
          />
        </section>
      </div>
    </main>
  );
}
