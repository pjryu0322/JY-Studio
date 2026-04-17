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

export default function TracePage() {
  return (
    <div>
      <WorkflowPageHeader
        title="추적"
        subtitle="실행·병합·환경 검증 이력을 한곳에서 보는 단계입니다. 통합 뷰는 실행이 돌아간 뒤에 의미가 있습니다."
        backHref="/execution"
        backLabel="실행으로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <WorkflowEmptyState
          title="표시할 추적 데이터 없음"
          message="아직 이 화면에 연결된 실행 이력이 없습니다. 실행 계획에서 작업을 준비하고 실행 환경을 검증한 뒤 다시 확인하세요."
          right={
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <Link href="/execution" style={linkPrimary}>
                실행 화면으로
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
