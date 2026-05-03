"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const row = (done: boolean): CSSProperties => ({
  fontSize: 12,
  lineHeight: 1.45,
  color: done ? t.textSecondary : t.textMuted,
  marginBottom: 6,
  paddingLeft: 10,
  borderLeft: `3px solid ${done ? t.accentTealFg : t.border}`,
});

export function FeaturePlanningSidebarContent() {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 8, letterSpacing: "0.02em" }}>참여 멤버</div>
      <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none", fontSize: 12, color: t.textPrimary }}>
        <li style={{ marginBottom: 6 }}>· 기획 리드</li>
        <li style={{ marginBottom: 6 }}>· 백엔드</li>
        <li>· 프론트</li>
      </ul>

      <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 8, letterSpacing: "0.02em" }}>현재 단계</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary, marginBottom: 14 }}>기능 정리</div>

      <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 8, letterSpacing: "0.02em" }}>입력 데이터 상태</div>
      <div style={row(true)}>액터 및 서비스 흐름 결과 있음</div>
      <div style={row(true)}>기능목록 초안 생성됨</div>
      <div style={row(false)}>메뉴구조 미생성</div>
      <div style={row(false)}>화면정의 진행중</div>
    </>
  );
}
