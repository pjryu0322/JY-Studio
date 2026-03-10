"use client";

import ScreenLabel from "@/components/entry/ScreenLabel";
import Link from "next/link";

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
            border: "1px solid rgba(90, 123, 214, 0.25)",
            borderRadius: 22,
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(247,251,255,0.98) 48%, rgba(238,246,255,0.98) 100%)",
            padding: 24,
            boxShadow: "0 18px 34px rgba(17, 31, 64, 0.08)",
            textAlign: "center",
          }}
        >
          <ScreenLabel screen="진입 허브" context="역할 선택" />
          <h1
            style={{
              margin: "14px 0 8px",
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
          <RoleCard
            title="Operator"
            description={["문서 업로드", "청킹 작업 수행", "구조 / 미리보기 / 청크 검토"]}
            ctaLabel="작업 시작"
            href="/workspace"
          />
          <RoleCard
            title="Manager"
            description={["작업 현황 모니터링", "실패 작업 확인", "템플릿 관리"]}
            ctaLabel="관리 화면"
            href="/admin"
          />
        </section>
      </div>
    </main>
  );
}

function RoleCard({
  title,
  description,
  ctaLabel,
  href,
}: {
  title: string;
  description: string[];
  ctaLabel: string;
  href: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(148, 163, 184, 0.24)",
        borderRadius: 22,
        background: "#fff",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
        padding: 20,
        display: "grid",
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, color: "#122549" }}>{title}</h2>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, color: "#475569", fontSize: 14 }}>
        {description.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link
        href={href}
        style={{
          marginTop: 2,
          display: "inline-flex",
          justifySelf: "start",
          textDecoration: "none",
          borderRadius: 12,
          border: "1px solid #2459d9",
          background: "linear-gradient(135deg, #2b64f3, #1f4ed8)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          padding: "9px 14px",
          boxShadow: "0 8px 16px rgba(37, 87, 220, 0.2)",
        }}
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
