"use client";

import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import { WorkspaceHubChromeIconButton, WorkspaceHubUsersIcon } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { uiTokens as t } from "@/components/ui/tokens";
import { useEffect, useMemo, useRef, useState } from "react";

export type RequirementsWorkspaceTopChromeProps = Readonly<{
  showScreenLabels: boolean;
  showProjectWorkflowNav: boolean;
  resolvedProjectIdTrimmed: string;
  inIdeationStage: boolean;
  conversationStatus: "idle" | "loading" | "loaded" | "error";
  ideationComplete: boolean;
  problemInterviewState: ProblemInterviewState | null | undefined;
  problemInterviewStrictFilled: number;
  busy: boolean;
  remoteLocked: boolean;
  onOrganizeRequirements: () => void | Promise<void>;
  onResetConversation: () => void | Promise<void>;
  resetConversationDisabled: boolean;
  memberControls?: { readonly count: number; readonly onOpen: () => void } | null;
  /** 서비스 기획 진행도(표시) + 슬롯 상세(아이콘 팝오버) */
  ideationInterviewUi?: {
    readonly readinessPercent: number;
    readonly covered: number;
    readonly total: number;
    readonly statusCounts?: Readonly<{ confirmed: number; partial: number; candidate: number; stale: number; empty: number }> | null;
    readonly remainingQuestionsEstimate: number;
    readonly orchestrationSlotSections?: readonly OrchestrationSlotSummarySection[] | null;
    readonly onForceGeneratePlanNow: () => void;
  } | null;
  onDownloadConversationMarkdown?: () => void | Promise<void>;
  onSummarizeConversation?: () => void | Promise<void>;
  canvasHubControls?: { readonly count: number; readonly onOpen: () => void } | null;
  artifactHubControls?: { readonly count: number; readonly onOpen: () => void } | null;
  workflowGuidanceBanner: string | null;
  loadError: string | null;
  onClearLoadErrorAndRetry: () => void;
  onGoHome: () => void;
}>;

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l.8 2.4L22 16l-2.2.6L19 19l-.8-2.4L16 16l2.2-.6L19 13z" />
    </svg>
  );
}

function SlotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CanvasHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function ArtifactHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

export function RequirementsWorkspaceTopChrome({
  showScreenLabels,
  showProjectWorkflowNav,
  resolvedProjectIdTrimmed,
  inIdeationStage,
  conversationStatus,
  ideationComplete,
  problemInterviewState,
  problemInterviewStrictFilled,
  busy,
  remoteLocked,
  onOrganizeRequirements,
  onResetConversation,
  resetConversationDisabled,
  memberControls,
  ideationInterviewUi,
  onDownloadConversationMarkdown,
  onSummarizeConversation,
  canvasHubControls,
  artifactHubControls,
  workflowGuidanceBanner,
  loadError,
  onClearLoadErrorAndRetry,
  onGoHome,
}: RequirementsWorkspaceTopChromeProps) {
  const showOrganizeCta =
    Boolean(resolvedProjectIdTrimmed) &&
    inIdeationStage &&
    conversationStatus === "loaded" &&
    ideationComplete &&
    true;

  const slotsUi = ideationInterviewUi ?? null;
  const [slotsOpen, setSlotsOpen] = useState(false);
  const slotsBtnRef = useRef<HTMLButtonElement | null>(null);
  const [slotsPos, setSlotsPos] = useState<{ top: number; right: number; maxH: number; narrow: boolean } | null>(null);
  const useOrchestrationGrid = Boolean(slotsUi?.orchestrationSlotSections?.some((s) => s.slots.length));

  const computeSlotsPos = () => {
    const btn = slotsBtnRef.current;
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const margin = 12;
    const top = Math.min(window.innerHeight - margin, r.bottom + 8);
    const right = Math.max(margin, window.innerWidth - r.right);
    const narrow = window.innerWidth < 820;
    const maxH = narrow
      ? Math.max(220, Math.floor((window.innerHeight - 20) * 0.5))
      : Math.max(220, Math.floor((window.innerHeight - top - margin) * 0.5));
    return { top, right, maxH, narrow };
  };

  useEffect(() => {
    if (!slotsOpen) return;
    const pos = computeSlotsPos();
    if (pos) setSlotsPos(pos);
  }, [slotsOpen]);

  useEffect(() => {
    if (!slotsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setSlotsOpen(false);
    };
    const onResize = () => {
      const pos = computeSlotsPos();
      if (pos) setSlotsPos(pos);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (slotsBtnRef.current?.contains(t)) return;
      const panel = document.getElementById("requirements-slots-popover");
      if (panel && panel.contains(t)) return;
      setSlotsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [slotsOpen]);

  const slotPanel = useMemo(() => {
    if (!slotsOpen || !slotsUi) return null;
    const pos = slotsPos ?? computeSlotsPos();
    if (!pos) return null;
    const sections = slotsUi.orchestrationSlotSections ?? [];
    const gridCols = pos.narrow ? 1 : 2;
    const panelW = pos.narrow ? "min(96vw, 420px)" : "min(92vw, 520px)";
    return (
      <>
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1090,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(2px)",
          }}
        />
        <div
          id="requirements-slots-popover"
          role="dialog"
          aria-label="서비스 기획 슬롯 상세"
          style={{
            position: "fixed",
            top: pos.narrow ? "max(10px, env(safe-area-inset-top, 0px))" : pos.top,
            right: pos.narrow ? "max(10px, env(safe-area-inset-right, 0px))" : pos.right,
            left: pos.narrow ? "max(10px, env(safe-area-inset-left, 0px))" : undefined,
            zIndex: 1100,
            width: pos.narrow ? "auto" : panelW,
            maxHeight: pos.maxH,
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 24px 64px -28px rgba(15, 23, 42, 0.35)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                서비스 기획 진행도 {slotsUi.readinessPercent}%
                {slotsUi.statusCounts ?
                  ` · 확정 ${slotsUi.statusCounts.confirmed} / 부분 ${slotsUi.statusCounts.partial} / 후보 ${slotsUi.statusCounts.candidate}`
                : ` · ${slotsUi.covered}/${slotsUi.total}`}
              </div>
              <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#0f766e", width: `${Math.min(100, Math.max(0, slotsUi.readinessPercent))}%` }} />
              </div>
            </div>
          <button
            type="button"
            onClick={() => setSlotsOpen(false)}
            aria-label="슬롯 상세 닫기"
            title="닫기"
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#0f172a",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
            }}
          >
            ×
          </button>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, overflow: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              확정 {slotsUi.covered} / 전체 {slotsUi.total}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
              예상 남은 질문: {Math.max(0, slotsUi.remainingQuestionsEstimate)}개
            </div>
          </div>
          {slotsUi.statusCounts ? (
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 10 }}>
              <span>부분 {slotsUi.statusCounts.partial}</span>
              <span>· 후보 {slotsUi.statusCounts.candidate}</span>
              <span>· stale {slotsUi.statusCounts.stale}</span>
              <span>· 미확보 {slotsUi.statusCounts.empty}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setSlotsOpen(false);
                void slotsUi.onForceGeneratePlanNow();
              }}
              style={{
                border: "1px solid #0f766e",
                background: "#ecfdf5",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 900,
                color: "#065f46",
                cursor: "pointer",
              }}
            >
              지금까지 내용으로 기획안 만들기
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>표시:</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{useOrchestrationGrid ? "✔ 확정" : "✔ 완료"}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>△ 부분</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{useOrchestrationGrid ? "□ 미확정" : "□ 미확보"}</span>
            </div>

            {useOrchestrationGrid ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {sections.map((sec) =>
                  sec.slots.length ? (
                    <details key={sec.sectionTitle} open style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                      <summary style={{ listStyle: "none", cursor: "pointer", padding: "10px 12px", fontSize: 12.5, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.sectionTitle}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b" }}>{sec.slots.length}</span>
                      </summary>
                      <div style={{ padding: "0 12px 12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gap: 8 }}>
                        {sec.slots.map((cell, idx) => {
                          const level = cell.level;
                          const icon = level === "filled" ? "✔" : level === "partial" ? "△" : "□";
                          const color = level === "filled" ? "#065f46" : level === "partial" ? "#92400e" : "#475569";
                          const bg = level === "filled" ? "#ecfdf5" : level === "partial" ? "#fffbeb" : "#f8fafc";
                          const border = level === "filled" ? "1px solid #a7f3d0" : level === "partial" ? "1px solid #fde68a" : "1px solid #e2e8f0";
                          return (
                            <div
                              key={`${sec.sectionTitle}-${idx}-${cell.label}`}
                              style={{
                                border,
                                background: bg,
                                borderRadius: 12,
                                padding: "10px 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{cell.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 900, color }}>{icon}</span>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    </details>
                  ) : null
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 12, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>오케스트레이션 슬롯을 불러오는 중…</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>□</span>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </>
    );
  }, [slotsOpen, slotsUi, slotsPos, useOrchestrationGrid]);

  return (
    <div className="jyo-requirements-workspace-top-chrome">
      <RequirementsHeader showProjectWorkflowNav={showProjectWorkflowNav} hideCompactWorkflowTitle />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, marginBottom: 6, gap: 8 }}>
        {slotPanel}
        {slotsUi ? (
          <WorkspaceHubChromeIconButton
            title="서비스 기획 슬롯 상세 보기"
            ariaLabel="서비스 기획 슬롯 상세 보기"
            disabled={false}
            buttonRef={(n) => {
              slotsBtnRef.current = n;
            }}
            onClick={() => setSlotsOpen((v) => !v)}
          >
            <SlotsIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        {canvasHubControls ? (
          <WorkspaceHubChromeIconButton
            title="Canvas Hub — 프로젝트 상태 Viewer"
            ariaLabel="Canvas Hub 열기"
            disabled={false}
            badge={canvasHubControls.count > 0 ? canvasHubControls.count : undefined}
            onClick={() => canvasHubControls.onOpen()}
          >
            <CanvasHubIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        {artifactHubControls ? (
          <WorkspaceHubChromeIconButton
            title="Artifact Hub — 산출물 생성·조회"
            ariaLabel="Artifact Hub 열기"
            disabled={false}
            badge={artifactHubControls.count > 0 ? artifactHubControls.count : undefined}
            onClick={() => artifactHubControls.onOpen()}
          >
            <ArtifactHubIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        {memberControls ? (
          <WorkspaceHubChromeIconButton
            title="참여 멤버/AI 보기"
            ariaLabel="참여 멤버/AI 보기"
            disabled={false}
            badge={memberControls.count}
            onClick={() => memberControls.onOpen()}
          >
            <WorkspaceHubUsersIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        {onDownloadConversationMarkdown ? (
          <WorkspaceHubChromeIconButton
            title="대화 내역 마크다운 다운로드"
            ariaLabel="대화 내역 마크다운 다운로드"
            disabled={false}
            onClick={() => onDownloadConversationMarkdown()}
          >
            <DownloadIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        {onSummarizeConversation ? (
          <WorkspaceHubChromeIconButton
            title="대화 내역 AI 요약"
            ariaLabel="대화 내역 AI 요약"
            disabled={busy || remoteLocked}
            onClick={() => onSummarizeConversation()}
          >
            <SparklesIcon />
          </WorkspaceHubChromeIconButton>
        ) : null}
        <WorkspaceHubChromeIconButton
          title="대화 초기화"
          ariaLabel="대화 초기화"
          disabled={resetConversationDisabled}
          onClick={() => onResetConversation()}
        >
          <RefreshIcon />
        </WorkspaceHubChromeIconButton>
      </div>

      {showOrganizeCta ? (
        <div
          style={{
            marginTop: 8,
            marginBottom: 6,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46", lineHeight: 1.45 }}>
            정리 요청으로 아이디어 초안을 만들 수 있습니다.
          </span>
          <button
            type="button"
            data-testid="requirements-organize-cta"
            disabled={busy || remoteLocked}
            onClick={() => void onOrganizeRequirements()}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#0f766e",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: busy || remoteLocked ? "not-allowed" : "pointer",
              opacity: busy || remoteLocked ? 0.55 : 1,
            }}
          >
            정리 요청
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 6 }} />
      )}

      {workflowGuidanceBanner ? (
        <div style={{ fontSize: 12, color: "#92400e", padding: "8px 10px", background: "#fffbeb", borderRadius: 8 }}>
          {workflowGuidanceBanner}
        </div>
      ) : null}

      {loadError ? (
        <div className="relative" style={{ position: "relative" }}>
          <ScreenLabel label="요구사항-상단-오류배너" visible={showScreenLabels} />
          <div style={{ fontSize: 12, color: "#64748b", padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }} role="status">
            {loadError}{" "}
            <button
              type="button"
              onClick={onClearLoadErrorAndRetry}
              style={{
                border: 0,
                background: "none",
                color: "#2563eb",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                font: "inherit",
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : null}

      {remoteLocked ? (
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
          프로젝트가 연결되지 않았습니다.{" "}
          <button
            type="button"
            onClick={onGoHome}
            style={{
              border: 0,
              background: "none",
              color: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              font: "inherit",
            }}
          >
            홈에서 프로젝트 만들기
          </button>
        </div>
      ) : null}

    </div>
  );
}
