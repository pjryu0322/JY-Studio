"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const linkBtnStyle: CSSProperties = {
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
  textDecoration: "none",
  display: "inline-block",
};

const OPERATIONS_INTRO =
  "플랫폼 기본 Grid 지식팩은 정적 seed로 제공됩니다. 사용자/프로젝트 지식팩은 DB에 등록·수정할 수 있으며, Agent–카테고리 매핑과 변경 이력은 각 메뉴에서 관리합니다. 참고 링크는 향후 KnowledgePackSource 단위로 확장되어 RAG 색인의 원천자료가 될 수 있습니다. AI 구조화·검수/승인 워크플로는 다음 단계입니다.";

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
        <Link href="/knowledge-packs/manage" prefetch={false} target="_blank" rel="noopener noreferrer" style={linkBtnStyle}>
          지식팩 등록
        </Link>
        <Link href="/knowledge-packs/agent-mapping" prefetch={false} style={linkBtnStyle}>
          Agent 매핑 설정
        </Link>
        <Link href="/knowledge-packs/history" prefetch={false} style={linkBtnStyle}>
          변경 이력
        </Link>
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
