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

export function ProjectKnowledgeRuntimeStatusCard(p: {
  readonly summary: KnowledgeRuntimeStatusSummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh?: () => void;
}) {
  if (p.loading) {
    return (
      <div data-testid="knowledge-runtime-status-card" style={cardStyle} aria-live="polite">
        <div style={{ fontWeight: 800, color: t.textMuted }}>구조화 상태</div>
        <div style={{ marginTop: 4, color: t.textMuted }}>불러오는 중…</div>
      </div>
    );
  }

  if (p.error) {
    return (
      <div data-testid="knowledge-runtime-status-card" style={cardStyle} role="alert">
        <div style={{ fontWeight: 800, color: t.textPrimary }}>구조화 상태</div>
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
        <div style={{ fontWeight: 800, color: t.textPrimary }}>구조화 상태</div>
        <div style={{ marginTop: 6, fontWeight: 800, color: t.textSecondary }}>
          {p.summary?.statusLabel ?? "준비 중"}
        </div>
        {resetTime ? (
          <div style={{ marginTop: 6, color: t.textMuted }}>마지막 초기화: {resetTime}</div>
        ) : null}
        <p style={{ margin: "8px 0 0", color: t.textMuted }}>
          {p.summary?.graphRegenerationMessage ??
            "아직 구조화된 항목이 없습니다. 기획 대화를 진행하면 구조화 상태가 표시됩니다."}
        </p>
      </div>
    );
  }

  const lastReset = p.summary.lastPlanningGraphResetAt
    ? formatKnowledgeRevisionTimeOnly(p.summary.lastPlanningGraphResetAt)
    : null;
  const lastApplied = p.summary.latestChangedAt
    ? formatKnowledgeRevisionTimeOnly(p.summary.latestChangedAt)
    : null;

  return (
    <div data-testid="knowledge-runtime-status-card" style={cardStyle}>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>구조화 상태</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: t.textPrimary }}>{p.summary.statusLabel}</div>
      <div style={{ marginTop: 6, color: t.textSecondary }}>
        항목 {p.summary.nodeCount}개 · 연결 {p.summary.edgeCount}개
      </div>
      {lastReset ? (
        <div style={{ marginTop: 4, color: t.textMuted }}>마지막 초기화: {lastReset}</div>
      ) : null}
      {lastApplied ? (
        <div style={{ marginTop: 2, color: t.textMuted }}>마지막 반영: {lastApplied}</div>
      ) : null}
      {p.summary.graphRegenerationMessage ? (
        <div style={{ marginTop: 6, color: t.textSecondary }}>{p.summary.graphRegenerationMessage}</div>
      ) : null}
      {p.summary.referenceEligibilityLabel ? (
        <div style={{ marginTop: 6, color: t.textSecondary }}>
          참조 준비: {p.summary.referenceEligibilityLabel}
          {p.summary.referenceEligibilityHint ? (
            <div style={{ marginTop: 4, fontSize: 11, color: t.textMuted }}>{p.summary.referenceEligibilityHint}</div>
          ) : null}
        </div>
      ) : null}
      {p.summary.latestChangeTitle ? (
        <div style={{ marginTop: 4, color: t.textSecondary }}>
          최근 변경: {p.summary.latestChangeTitle}
        </div>
      ) : null}
      {p.onRefresh ? (
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
      ) : null}
    </div>
  );
}
