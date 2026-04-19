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

const timelineSteps = [
  { label: "아이디어 구체화", hint: "승인·스펙" },
  { label: "기능 정리", hint: "범위 단위" },
  { label: "작업 정리", hint: "실행 단위" },
  { label: "프로토타입 결과", hint: "로그·PR" },
] as const;

export default function TracePage() {
  return (
    <div>
      <WorkflowPageHeader
        title="추적"
        subtitle="아이디어 구체화 ↔ 기능 정리 ↔ 작업 정리 ↔ 프로토타입 결과를 한눈에 잇는 화면입니다. 데이터가 쌓이면 타임라인이 채워집니다."
        backHref="/execution"
        backLabel="프로토타입 생성으로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>연결 흐름</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 0 }}>
            {timelineSteps.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", flex: "1 1 120px", minWidth: 100 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: i === 0 ? "#2563eb" : "#cbd5e1",
                      margin: "0 auto 6px",
                      border: "2px solid #fff",
                      boxShadow: "0 0 0 2px #e2e8f0",
                    }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.hint}</div>
                </div>
                {i < timelineSteps.length - 1 ? (
                  <div style={{ flex: "0 0 24px", height: 2, background: "#e2e8f0", alignSelf: "center", marginTop: -18 }} />
                ) : null}
              </div>
            ))}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>아직 연결 데이터 없음</div>
          <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
            아이디어 구체화와 생성 준비를 마치면, 작업 정리·프로토타입 생성 단계에서 자동으로 추적 후보가 생깁니다.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/requirements" style={btnSecondary}>
              아이디어 구체화
            </Link>
            <Link href="/" style={btnPrimary}>
              생성 준비(홈)
            </Link>
            <Link href="/execution" style={btnSecondary}>
              프로토타입 생성
            </Link>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={16}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>현재 연결 가능한 항목 보기</div>
          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
            협업 세션·작업 URL을 알고 있다면 프로토타입 생성·작업 정리 화면에서 바로 열 수 있습니다.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/tasks" style={btnSecondary}>
              작업 (?requirementId=)
            </Link>
            <Link href="/execution" style={btnSecondary}>
              실행 (?sessionId=)
            </Link>
          </div>
        </WorkflowCard>

        <details style={{ borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", background: "#fff" }}>
          <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: 14, color: "#1e3a8a" }}>
            타임라인 예시 (데모)
          </summary>
          <WorkflowDemoSampleBanner>아래는 UI 예시용 샘플 타임라인입니다.</WorkflowDemoSampleBanner>
          <ol style={{ margin: "12px 0 0 0", paddingLeft: 20, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            <li>09:10 아이디어 정리 초안 저장</li>
            <li>09:40 기능 범위 확정 (샘플)</li>
            <li>10:05 작업 PR 생성 (샘플)</li>
            <li>10:22 프로토타입 검증 완료 (샘플)</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
