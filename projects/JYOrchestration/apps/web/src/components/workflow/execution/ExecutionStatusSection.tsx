import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { EXECUTION_EXECUTOR_TYPES, EXECUTOR_TYPE_LABELS } from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionSummaryView } from "@/lib/workflow/executionViewState";
import type { ExecutionPageContentActions } from "./executionPageTypes";
import { dispatchPrimaryExecutionAction, inlineKpi, toneOrNeutral } from "./executionPageUiHelpers";

export type ExecutionStatusSectionProps = {
  sessionId: string | null;
  summary: ExecutionSummaryView;
  pageActions: ExecutionPageContentActions;
};

export function ExecutionStatusSection(props: ExecutionStatusSectionProps) {
  const { sessionId, summary, pageActions } = props;

  return (
    <WorkflowCard padding={12}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>현재 실행 상태</div>
      {!sessionId ? (
        <WorkflowEmptyState
          title="세션 없음"
          message="세션의 실행 상태를 보려면 URL에 ?sessionId= (선택적으로 ?requirementId=)를 추가하세요."
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {summary.contextLine ? <div style={{ fontSize: 12, color: "#6b7280" }}>{summary.contextLine}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {summary.kpis.map((k) => inlineKpi(k.label, k.value, toneOrNeutral(k.tone)))}
          </div>

          <div
            style={{
              border: summary.primaryAction.key === "none" ? "1px solid #e5e7eb" : "2px solid #2563eb",
              borderRadius: 12,
              padding: 12,
              background: summary.primaryAction.key === "none" ? "#fafafa" : "#eff6ff",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: "#1e40af", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
              다음 동작
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <WorkflowActionButton label="작업 화면 열기" variant="secondary" onClick={pageActions.openTasks} />
              {summary.primaryAction.key === "none" ? (
                <div style={{ fontSize: 12, color: "#6b7280" }}>{summary.primaryAction.note ?? "최신 상태입니다."}</div>
              ) : summary.primaryAction.key === "assignExecutor" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {EXECUTION_EXECUTOR_TYPES.map((t) => (
                    <WorkflowActionButton
                      key={t}
                      label={EXECUTOR_TYPE_LABELS[t]}
                      variant="primary"
                      disabled={summary.primaryAction.disabled}
                      onClick={() => pageActions.assignExecutor(t)}
                    />
                  ))}
                </div>
              ) : (
                <WorkflowActionButton
                  label={summary.primaryAction.label}
                  variant="primary"
                  disabled={summary.primaryAction.disabled}
                  onClick={() => {
                    dispatchPrimaryExecutionAction(summary.primaryAction.key, pageActions);
                  }}
                />
              )}
            </div>
          </div>

          {summary.primaryAction.note ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{summary.primaryAction.note}</div>
          ) : null}
          {summary.nextActionNote ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{summary.nextActionNote}</div>
          ) : null}
        </div>
      )}
    </WorkflowCard>
  );
}
