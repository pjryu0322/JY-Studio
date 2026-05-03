"use client";

import type { CSSProperties } from "react";
import type { WorkspaceArtifactTabId } from "@/components/workspace/WorkspaceArtifactTabs";
import { uiTokens as t } from "@/components/ui/tokens";

const card: CSSProperties = {
  border: `1px solid ${t.border}`,
  borderRadius: t.radiusMd,
  padding: "12px 14px",
  marginBottom: 10,
  background: t.bgPage,
  fontSize: 13,
  color: t.textSecondary,
  lineHeight: 1.5,
};

function Card({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>{title}</div>
      <div>{body}</div>
    </div>
  );
}

export function FeaturePlanningArtifactPlaceholder({ tabId }: { readonly tabId: WorkspaceArtifactTabId }) {
  switch (tabId) {
    case "features":
      return (
        <>
          <Card title="기능 후보 A" body="로그인 · 세션 유지 · 권한 검증(플레이스홀더)" />
          <Card title="기능 후보 B" body="데이터보내기 · 감사 로그(플레이스홀더)" />
        </>
      );
    case "menu":
      return (
        <>
          <Card title="최상위" body="대시보드 / 설정 / 도움말(플레이스홀더)" />
          <Card title="업무 메뉴" body="목록 · 상세 · 등록(플레이스홀더)" />
        </>
      );
    case "screens":
      return (
        <>
          <Card title="SCR-001" body="목록 화면 — 필터·정렬·페이지네이션(플레이스홀더)" />
          <Card title="SCR-002" body="상세 화면 — 탭·첨부(플레이스홀더)" />
        </>
      );
    case "screenFunctions":
      return (
        <>
          <Card title="SCR-001 연결 기능" body="조회 · 검색 · 일괄 처리(플레이스홀더)" />
          <Card title="SCR-002 연결 기능" body="저장 · 승인 요청(플레이스홀더)" />
        </>
      );
    case "workflow":
      return (
        <>
          <Card title="흐름 단계 1" body="요청 접수 → 검토(플레이스홀더)" />
          <Card title="흐름 단계 2" body="승인 → 통지(플레이스홀더)" />
        </>
      );
    case "taskDraft":
      return (
        <>
          <Card title="Task 초안 #1" body="API 스캐폴딩 · 단위 테스트(플레이스홀더)" />
          <Card title="Task 초안 #2" body="UI 컴포넌트 · 접근성(플레이스홀더)" />
        </>
      );
    default:
      return null;
  }
}
