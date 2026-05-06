"use client";

import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import { PROBLEM_INTERVIEW_SLOT_TOTAL } from "@/lib/requirements/problemInterview";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
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
  problemInterviewState,
  problemInterviewStrictFilled,
  busy,
  remoteLocked,
  onOrganizeRequirements,
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
    !(
      problemInterviewState &&
      problemInterviewState.active !== false &&
      problemInterviewStrictFilled < PROBLEM_INTERVIEW_SLOT_TOTAL
    );

  return (
    <div className="jyo-requirements-workspace-top-chrome">
      <RequirementsHeader showProjectWorkflowNav={showProjectWorkflowNav} />

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

      {inIdeationStage && resolvedProjectIdTrimmed && conversationStatus === "loaded" && problemInterviewState && problemInterviewState.active !== false ? (
        <div
          style={{
            marginTop: 6,
            marginBottom: 10,
            padding: "8px 2px",
            borderRadius: 10,
            color: "#64748b",
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          아이디어 구체화 단계입니다. 핵심만 짧게 확인하고, 상세 액터·흐름·기능·Task는 다음 탭에서 이어서 정리합니다.
        </div>
      ) : null}
    </div>
  );
}
