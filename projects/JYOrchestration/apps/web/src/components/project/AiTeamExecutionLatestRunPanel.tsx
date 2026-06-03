"use client";

import { AiTeamRuntimeApproveSection } from "@/components/project/AiTeamRuntimeApproveSection";
import { AiTeamRuntimeSummaryDl } from "@/components/project/AiTeamRuntimeSummaryDl";
import { AiTeamRuntimeTimelineList } from "@/components/project/AiTeamRuntimeTimelineList";
import { useAiTeamRuntimeWorkflowApprove } from "@/components/project/useAiTeamRuntimeWorkflowApprove";
import { useLatestProjectExecutionRun } from "@/components/project/useLatestProjectExecutionRun";

const panelSectionStyle = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
} as const;

export function AiTeamExecutionLatestRunPanel({ projectId }: { projectId: string }) {
  const trimmedProjectId = projectId.trim();
  const { run, loading, reload } = useLatestProjectExecutionRun(projectId);
  const { approving, error, successMessage, approve } = useAiTeamRuntimeWorkflowApprove(reload);

  if (!trimmedProjectId) return null;

  const team = run?.teamRuntime;
  const timeline = team?.timeline ?? [];
  const showApproveButton = team?.status === "approval_waiting" && Boolean(run?.taskId);

  return (
    <section data-testid="ai-team-execution-latest-run" style={panelSectionStyle}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        AI팀 실행 Runtime (최근 기록)
      </h3>
      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>불러오는 중…</p>
      ) : !run || !team ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>실행 기록이 없습니다.</p>
      ) : (
        <>
          <AiTeamRuntimeSummaryDl team={team} />
          {showApproveButton && run.taskId ? (
            <AiTeamRuntimeApproveSection
              approving={approving}
              successMessage={successMessage}
              error={error}
              onApprove={() => void approve(run.taskId)}
            />
          ) : null}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              AI팀 실행 타임라인
            </h4>
            <AiTeamRuntimeTimelineList items={timeline} />
          </div>
        </>
      )}
    </section>
  );
}
