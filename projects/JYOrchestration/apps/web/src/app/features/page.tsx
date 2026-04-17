"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";

const linkPrimary: CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  fontSize: 13,
};

const linkSecondary: CSSProperties = {
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
        title="기능"
        subtitle="협업·스펙에서 정리된 기능 단위가 이 단계에 모입니다. 아직 카탈로그가 비어 있으면 이전 단계로 돌아가 맥락을 채우세요."
        backHref="/collaboration"
        backLabel="협업으로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <WorkflowEmptyState
          title="등록된 기능 없음"
          message="이 화면은 아직 실데이터 목록과 연결되지 않았습니다. 공식 순서대로 협업을 진행하고, 실행 계획에서 스펙·계획을 확정하면 작업 단계로 자연스럽게 이어집니다."
          right={
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <Link href="/collaboration" style={linkPrimary}>
                이전 단계: 협업
              </Link>
              <Link href="/" style={linkSecondary}>
                실행 계획(홈)
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
