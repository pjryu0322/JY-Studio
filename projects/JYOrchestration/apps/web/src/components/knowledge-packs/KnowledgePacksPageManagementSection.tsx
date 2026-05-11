"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const MANAGEMENT_STUBS = [
  { label: "지식팩 등록", message: "지식팩 등록 기능은 다음 단계에서 제공됩니다." },
  { label: "Agent 매핑 설정", message: "AI Agent와 카테고리 매핑 설정은 다음 단계에서 제공됩니다." },
  { label: "변경 이력", message: "지식팩 변경 이력 관리는 다음 단계에서 제공됩니다." },
] as const;

const OPERATIONS_INTRO =
  "현재는 플랫폼 기본 AI개발자 Grid 지식팩을 정적 seed로 제공합니다. 다음 단계에서는 사용자/조직/프로젝트 단위 지식팩 등록, AI 구조화, Agent별 최적화, 검수/승인, 버전/이력관리를 지원할 예정입니다.";

const btnStyle: CSSProperties = {
  flex: "1 1 140px",
  minWidth: 0,
  maxWidth: "100%",
  padding: "8px 12px",
  borderRadius: t.radiusMd,
  border: `1px solid ${t.border}`,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: t.textSecondary,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
  boxSizing: "border-box",
};

export function KnowledgePacksPageManagementSection() {
  return (
    <>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
          alignItems: "stretch",
          maxWidth: "100%",
        }}
      >
        {MANAGEMENT_STUBS.map((row) => (
          <button key={row.label} type="button" style={btnStyle} onClick={() => window.alert(row.message)}>
            {row.label}
          </button>
        ))}
      </div>

      <div
        style={{
          flexShrink: 0,
          marginBottom: 14,
          padding: "12px 14px",
          borderRadius: t.radiusLg,
          border: `1px solid ${t.border}`,
          background: "#f8fafc",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 6, letterSpacing: "0.03em" }}>운영 구조 안내</div>
        <p style={{ fontSize: 13, color: t.textPrimary, lineHeight: 1.55, margin: 0, overflowWrap: "anywhere" }}>{OPERATIONS_INTRO}</p>
      </div>
    </>
  );
}
