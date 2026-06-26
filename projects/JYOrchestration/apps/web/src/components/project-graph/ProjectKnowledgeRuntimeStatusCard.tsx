"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { formatKnowledgeRevisionTimeOnly } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

const cardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: "#f8fafc",
  fontSize: 12,
  lineHeight: 1.45,
};

const actionBtnStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
};

export function ProjectKnowledgeRuntimeStatusCard(p: {
  readonly summary: KnowledgeRuntimeStatusSummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh?: () => void;
  readonly variant?: "user" | "diagnostic";
  readonly onOpenChangeLog?: () => void;
}) {
  const userMode = p.variant !== "diagnostic";

  if (p.loading) {
    return (
      <div data-testid="knowledge-runtime-status-card" style={cardStyle} aria-live="polite">
        <div style={{ fontWeight: 800, color: t.textMuted }}>{userMode ? "현재 프로젝트 구조" : "구조화 상태"}</div>
        <div style={{ marginTop: 4, color: t.textMuted }}>불러오는 중…</div>
      </div>
    );
  }

  if (p.error) {
    return (
      <div data-testid="knowledge-runtime-status-card" style={cardStyle} role="alert">
        <div style={{ fontWeight: 800, color: t.textPrimary }}>{userMode ? "현재 프로젝트 구조" : "구조화 상태"}</div>
        <div style={{ marginTop: 4, color: "#b91c1c" }}>상태를 불러오지 못했습니다.</div>
        {p.onRefresh ? (
          <button
            type="button"
            data-testid="knowledge-runtime-status-refresh"
            onClick={p.onRefresh}
            style={{ marginTop: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            다시 시도
          </button>
        ) : null}
      </div>
    );
  }

  if (!p.summary || (p.summary.status === "PREPARING" && p.summary.nodeCount === 0)) {
    const resetTime = p.summary?.lastPlanningGraphResetAt
      ? formatKnowledgeRevisionTimeOnly(p.summary.lastPlanningGraphResetAt)
      : null;
    return (
      <div data-testid="knowledge-runtime-status-card" style={cardStyle}>
        <div style={{ fontWeight: 800, color: t.textPrimary }}>{userMode ? "현재 프로젝트 구조" : "구조화 상태"}</div>
        {!userMode ? (
          <div style={{ marginTop: 6, fontWeight: 800, color: t.textSecondary }}>
            {p.summary?.statusLabel ?? "준비 중"}
          </div>
        ) : null}
        {resetTime ? (
          <div style={{ marginTop: 6, color: t.textMuted }}>
            {userMode ? `초기화: ${resetTime}` : `마지막 초기화: ${resetTime}`}
          </div>
        ) : null}
        <p style={{ margin: "8px 0 0", color: t.textMuted }}>
          {p.summary?.graphRegenerationMessage ??
            "아직 구조화된 항목이 없습니다. 기획 대화를 진행하면 구조화 상태가 표시됩니다."}
        </p>
        {userMode ? renderUserActions(p) : renderDiagnosticRefresh(p)}
      </div>
    );
  }

  const lastReset = p.summary.lastPlanningGraphResetAt
    ? formatKnowledgeRevisionTimeOnly(p.summary.lastPlanningGraphResetAt)
    : null;
  const lastApplied = p.summary.latestChangedAt
    ? formatKnowledgeRevisionTimeOnly(p.summary.latestChangedAt)
    : null;

  const needsAttention =
    userMode &&
    (p.summary.status === "NEEDS_REVIEW" ||
      Boolean(p.summary.referenceEligibilityHint && p.summary.referenceEligibilityLabel !== "참조 가능"));

  return (
    <div data-testid="knowledge-runtime-status-card" style={cardStyle}>
      <div style={{ fontSize: userMode ? 14 : 11, fontWeight: 900, color: t.textPrimary }}>
        {userMode ? "현재 프로젝트 구조" : "구조화 상태"}
      </div>
      {!userMode ? (
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: t.textPrimary }}>{p.summary.statusLabel}</div>
      ) : needsAttention ? (
        <div style={{ marginTop: 6, color: "#b45309", fontWeight: 800 }}>프로젝트 구조를 더 정리해야 합니다.</div>
      ) : p.summary.status === "READY" ? (
        <div style={{ marginTop: 6, color: t.textSecondary }}>현재 프로젝트 구조가 정리되었습니다.</div>
      ) : null}
      <div style={{ marginTop: 6, color: t.textSecondary }}>
        항목 {p.summary.nodeCount}개 · 연결 {p.summary.edgeCount}개
      </div>
      {lastApplied ? (
        <div style={{ marginTop: 4, color: t.textMuted }}>최근 반영: {lastApplied}</div>
      ) : null}
      {!userMode && lastReset ? (
        <div style={{ marginTop: 4, color: t.textMuted }}>마지막 초기화: {lastReset}</div>
      ) : null}
      {p.summary.graphRegenerationMessage ? (
        <div style={{ marginTop: 6, color: t.textSecondary }}>{p.summary.graphRegenerationMessage}</div>
      ) : null}
      {userMode && needsAttention && p.summary.referenceEligibilityHint ? (
        <div style={{ marginTop: 6, color: t.textMuted }}>{p.summary.referenceEligibilityHint}</div>
      ) : null}
      {!userMode && p.summary.referenceEligibilityLabel ? (
        <div style={{ marginTop: 6, color: t.textSecondary }}>
          참조 준비: {p.summary.referenceEligibilityLabel}
          {p.summary.referenceEligibilityHint ? (
            <div style={{ marginTop: 4, fontSize: 11, color: t.textMuted }}>{p.summary.referenceEligibilityHint}</div>
          ) : null}
        </div>
      ) : null}
      {!userMode && p.summary.latestChangeTitle ? (
        <div style={{ marginTop: 4, color: t.textSecondary }}>최근 변경: {p.summary.latestChangeTitle}</div>
      ) : null}
      {userMode ? renderUserActions(p) : renderDiagnosticRefresh(p)}
    </div>
  );
}

function renderUserActions(p: {
  readonly onRefresh?: () => void;
  readonly onOpenChangeLog?: () => void;
}) {
  if (!p.onRefresh && !p.onOpenChangeLog) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {p.onOpenChangeLog ? (
        <button
          type="button"
          data-testid="knowledge-open-change-log"
          onClick={p.onOpenChangeLog}
          style={actionBtnStyle}
        >
          변경 내용 보기
        </button>
      ) : null}
      {p.onRefresh ? (
        <button
          type="button"
          data-testid="knowledge-runtime-status-refresh"
          aria-label="프로젝트 구조 새로고침"
          onClick={p.onRefresh}
          style={actionBtnStyle}
        >
          새로고침
        </button>
      ) : null}
    </div>
  );
}

function renderDiagnosticRefresh(p: { readonly onRefresh?: () => void }) {
  if (!p.onRefresh) return null;
  return (
    <button
      type="button"
      data-testid="knowledge-runtime-status-refresh"
      aria-label="구조화 상태 새로고침"
      onClick={p.onRefresh}
      style={{
        marginTop: 8,
        fontSize: 11,
        fontWeight: 700,
        color: t.primary,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
      }}
    >
      새로고침
    </button>
  );
}
