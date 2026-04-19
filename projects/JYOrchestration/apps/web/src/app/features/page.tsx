"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowDemoSampleBanner } from "@/components/workflow/primitives/WorkflowDemoSampleBanner";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";

const btnPrimary: CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 13,
};

const btnSecondary: CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fafafa",
  color: "#111827",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: 13,
};

export default function FeaturesPage() {
  return (
    <div>
      <WorkflowPageHeader
        title="기능 정리"
        subtitle="아이디어가 정리되고 스펙이 확정되면, 기능 단위로 나뉘어 작업 정리·생성 준비로 이어집니다."
        backHref="/requirements"
        backLabel="아이디어 구체화로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>시작 안내</div>
          <ul style={{ margin: "0 0 14px 0", paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
            <li>기능 목록은 아이디어 승인·스펙 확정 후 자동으로 후보가 쌓이도록 설계되어 있습니다.</li>
            <li>생성 준비(프로젝트 허브)에서 AI로 스펙을 생성·확정하면 이후 단계가 자연스럽게 열립니다.</li>
            <li>지금은 데이터가 없어도, 아래 버튼으로 다음 행동을 선택할 수 있습니다.</li>
          </ul>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/requirements" style={btnPrimary}>
              아이디어 구체화로
            </Link>
            <Link href="/" style={btnSecondary}>
              생성 준비(홈) — AI 스펙
            </Link>
            <Link href="/tasks" style={btnSecondary}>
              작업 정리 화면
            </Link>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>수동·초안</div>
          <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            기능 목록의 직접 편집 UI는 생성 준비·스펙 워크스페이스와 연결해 확장할 예정입니다. 지금은 생성 준비 화면에서 텍스트로
            아이디어를 구체화하는 것이 가장 빠른 경로입니다.
          </p>
          <Link href="/" style={btnPrimary}>
            생성 준비에서 이어하기
          </Link>
        </WorkflowCard>

        <details style={{ borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", background: "#fff" }}>
          <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 14, color: "#1e3a8a" }}>
            샘플 구조 보기 (데모)
          </summary>
          <WorkflowDemoSampleBanner>아래 카드는 UI 예시용 샘플이며 실제 데이터가 아닙니다.</WorkflowDemoSampleBanner>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {["회의록 업로드", "요약·액션 추출", "권한 관리"].map((title) => (
              <div
                key={title}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                {title} <span style={{ fontWeight: 600, color: "#64748b" }}>· 우선순위 P1 (샘플)</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
