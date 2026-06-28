"use client";

import { useState, type CSSProperties } from "react";
import { ProjectRightDrawerShell } from "@/components/ui/ProjectRightDrawerShell";
import { uiTokens as t } from "@/components/ui/tokens";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

export type ProjectKnowledgeGraphLogTab = "changes" | "knowledge" | "diagnostics";

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 16px",
  borderBottom: `1px solid ${t.border}`,
  flexShrink: 0,
};

const tabRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  padding: "10px 16px",
  borderBottom: `1px solid ${t.border}`,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "16px",
  fontSize: 12,
  lineHeight: 1.55,
  color: t.textSecondary,
};

const tabBtn = (active: boolean): CSSProperties => ({
  fontSize: 12,
  fontWeight: active ? 800 : 600,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${active ? t.primary : t.border}`,
  background: active ? "#eff6ff" : t.bgPage,
  color: active ? t.primary : t.textPrimary,
  cursor: "pointer",
});

const actionBtn: CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
};

export function ProjectKnowledgeGraphLogDrawer(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onOpenChangeLog?: () => void;
  readonly onOpenKnowledgeLog?: () => void;
  readonly onOpenDiagnosticLog?: () => void;
  readonly onOpenGraphReplay?: () => void;
  readonly runtimeSummary?: KnowledgeRuntimeStatusSummary | null;
  readonly initialTab?: ProjectKnowledgeGraphLogTab;
}) {
  const [tab, setTab] = useState<ProjectKnowledgeGraphLogTab>(p.initialTab ?? "changes");

  const openTab = (next: ProjectKnowledgeGraphLogTab) => {
    setTab(next);
  };

  const goChanges = () => {
    p.onOpenChangeLog?.();
    p.onClose();
  };

  const goKnowledge = () => {
    p.onOpenKnowledgeLog?.();
    p.onClose();
  };

  const goDiagnostics = () => {
    p.onOpenDiagnosticLog?.();
    p.onClose();
  };

  const goReplay = () => {
    p.onOpenGraphReplay?.();
    p.onClose();
  };

  if (!p.open) return null;

  return (
    <ProjectRightDrawerShell open={p.open} onClose={p.onClose} ariaLabel="프로젝트 지식 로그">
      <div
        data-testid="knowledge-graph-log-drawer"
        style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        <div style={headerStyle}>
          <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>로그</div>
          <button
            type="button"
            aria-label="닫기"
            data-testid="knowledge-graph-log-close"
            onClick={p.onClose}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgPage,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
        <div style={tabRowStyle} role="tablist" aria-label="로그 종류">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "changes"}
            data-testid="knowledge-log-tab-changes"
            style={tabBtn(tab === "changes")}
            onClick={() => openTab("changes")}
          >
            변경 로그
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "knowledge"}
            data-testid="knowledge-log-tab-knowledge"
            style={tabBtn(tab === "knowledge")}
            onClick={() => openTab("knowledge")}
          >
            생성 과정
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "diagnostics"}
            data-testid="knowledge-log-tab-diagnostics"
            style={tabBtn(tab === "diagnostics")}
            onClick={() => openTab("diagnostics")}
          >
            진단 정보
          </button>
        </div>
        <div style={bodyStyle}>
          {tab === "changes" ? (
            <>
              <p style={{ margin: "0 0 8px" }}>
                지식 그래프에 반영된 변경 이력과 대화 연결을 확인합니다.
              </p>
              {p.onOpenChangeLog ? (
                <button type="button" data-testid="knowledge-log-open-changes" style={actionBtn} onClick={goChanges}>
                  변경 로그 화면 열기
                </button>
              ) : null}
              {p.onOpenGraphReplay ? (
                <button type="button" data-testid="knowledge-log-open-replay" style={actionBtn} onClick={goReplay}>
                  그래프 변화 보기
                </button>
              ) : null}
            </>
          ) : null}
          {tab === "knowledge" ? (
            <>
              <p style={{ margin: "0 0 8px" }}>지식 생성·파이프라인 실행 과정을 확인합니다.</p>
              {p.onOpenKnowledgeLog ? (
                <button type="button" data-testid="knowledge-log-open-knowledge" style={actionBtn} onClick={goKnowledge}>
                  생성 과정 화면 열기
                </button>
              ) : null}
            </>
          ) : null}
          {tab === "diagnostics" ? (
            <>
              <p style={{ margin: "0 0 8px" }}>구조화·참조 준비 상태 등 진단 정보를 확인합니다.</p>
              {p.runtimeSummary?.graphRegenerationMessage ? (
                <p style={{ margin: "0 0 12px", color: t.textMuted, fontSize: 11 }}>
                  {p.runtimeSummary.graphRegenerationMessage}
                </p>
              ) : null}
              {p.runtimeSummary?.referenceEligibilityHint ? (
                <p style={{ margin: "0 0 12px", color: t.textMuted, fontSize: 11 }}>
                  {p.runtimeSummary.referenceEligibilityHint}
                </p>
              ) : null}
              {p.onOpenDiagnosticLog ? (
                <button
                  type="button"
                  data-testid="knowledge-log-open-diagnostics"
                  style={actionBtn}
                  onClick={goDiagnostics}
                >
                  진단 정보 화면 열기
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </ProjectRightDrawerShell>
  );
}
