"use client";

import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import { WorkspaceConversationHubIconRow } from "@/components/workspace/WorkspaceConversationHubIconRow";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
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
  artifactHubControls?: {
    readonly count: number;
    readonly hasStale?: boolean;
    readonly onOpen: () => void;
  } | null;
  workflowGuidanceBanner: string | null;
  loadError: string | null;
  onClearLoadErrorAndRetry: () => void;
  onGoHome: () => void;
}>;

export function RequirementsWorkspaceTopChrome({
  showScreenLabels,
  showProjectWorkflowNav,
  resolvedProjectIdTrimmed,
  inIdeationStage,
  conversationStatus,
  ideationComplete,
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
    ideationComplete;

  return (
    <div className="jyo-requirements-workspace-top-chrome">
      <RequirementsHeader showProjectWorkflowNav={showProjectWorkflowNav} hideCompactWorkflowTitle />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 6,
          marginBottom: 6,
          gap: 8,
        }}
      >
        <WorkspaceConversationHubIconRow
          busy={busy}
          remoteLocked={remoteLocked}
          interviewUi={ideationInterviewUi}
          memberControls={memberControls}
          canvasHubControls={canvasHubControls}
          artifactHubControls={artifactHubControls}
          onDownloadConversationMarkdown={onDownloadConversationMarkdown}
          onResetConversation={onResetConversation}
          onSummarizeConversation={onSummarizeConversation}
          resetConversationDisabled={resetConversationDisabled}
          downloadDisabled={!onDownloadConversationMarkdown}
        />
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
