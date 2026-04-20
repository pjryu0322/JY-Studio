import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import type { PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { ExecutionPageContentActions } from "./executionPageTypes";

export type ExecutionAdvancedDiagnosticsSectionProps = {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  nextAction: PreLaunchActionAvailability;
  pageActions: ExecutionPageContentActions;
};

export function ExecutionAdvancedDiagnosticsSection(props: ExecutionAdvancedDiagnosticsSectionProps) {
  const { sessionId, pre, nextAction, pageActions } = props;

  const snapshot = pre.snapshot;
  const isActive = pre.isSnapshotActive;
  const launchReadiness = pre.launchReadiness;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffPrepared = pre.handoffPrepared;
  const snapshotStaleness = pre.snapshotStaleness;
  const handoffValidity = pre.handoffValidity;

  return (
    <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>고급 세부(진단)</summary>
      <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
        {/* Snapshot, launch readiness gating, and raw pre-launch actions — secondary to the main process sections above. */}
        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>준비된 실행 입력</div>

          {!sessionId ? (
            <WorkflowEmptyState
              title="세션 없음"
              message="특정 세션의 준비 스냅샷을 보려면 URL에 ?sessionId= (선택적으로 ?requirementId=)를 추가하세요."
            />
          ) : snapshot ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                이 세션에 스냅샷이 있습니다. 실행은 시작되지 않았으며, 실행 전 읽기 전용 입력 소스입니다.
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                활성 입력:{" "}
                {isActive ? (
                  <span style={{ fontWeight: 900, color: "#166534" }}>선택됨</span>
                ) : pre.active ? (
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>
                    {pre.active.sessionId} / {pre.active.snapshotId}
                  </span>
                ) : (
                  <span>(없음)</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                <span style={{ fontWeight: 900 }}>{snapshot.summary.candidateCount}</span>개 후보 · 스냅샷{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.snapshotId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                세션 ID: <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.sessionId}</span> · 요구사항 ID:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.requirementId ?? "(없음)"}</span> · 준비 시각:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.preparedAtIso}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isActive ? "활성 입력 선택됨" : "활성 입력으로 선택"}
                  variant="primary"
                  onClick={pageActions.selectActiveInput}
                  disabled={isActive}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                이 세션에 준비된 실행 스냅샷이 아직 없습니다. 먼저 작업 화면에서 준비하세요.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="작업 화면 열기" variant="primary" onClick={pageActions.openTasks} />
              </div>
            </div>
          )}

          {sessionId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
            </div>
          ) : null}
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>실행 준비</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            활성 준비 입력에 대한 실행 전 검증 체크포인트입니다. 여기서 실행은 트리거되지 않습니다.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#111827" }}>
              상태:{" "}
              {launchReadiness.isLaunchReady ? (
                <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span>
              ) : (
                <span style={{ fontWeight: 900, color: "#b45309" }}>미준비</span>
              )}
            </div>
            {!launchReadiness.isLaunchReady ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                {launchReadiness.reasons.map((r) => (
                  <div key={r}>- {r}</div>
                ))}
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>다음 동작(원문)</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {isHandoffPrepared && handoffPrepared ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 900, color: "#166534" }}>인수 준비됨</span> · 준비 시각{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span> · 스냅샷{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.snapshotId}</span>
              </div>
            ) : null}
            {snapshot ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                스냅샷:{" "}
                {snapshotStaleness.isSnapshotStale ? (
                  <span style={{ fontWeight: 900, color: "#b45309" }}>오래됨</span>
                ) : (
                  <span style={{ fontWeight: 900, color: "#166534" }}>최신</span>
                )}
                {snapshotStaleness.isSnapshotStale && snapshotStaleness.staleReason ? ` • ${snapshotStaleness.staleReason}` : ""}
              </div>
            ) : null}
            {isHandoffPrepared ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                인수 유효성:{" "}
                {handoffValidity.isHandoffValid ? (
                  <span style={{ fontWeight: 900, color: "#166534" }}>유효</span>
                ) : (
                  <span style={{ fontWeight: 900, color: "#b45309" }}>무효</span>
                )}
                {!handoffValidity.isHandoffValid && handoffValidity.invalidReason ? ` • ${handoffValidity.invalidReason}` : ""}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isHandoffPrepared ? "인수 준비됨" : nextAction.actionLabel}
                variant="primary"
                disabled={!nextAction.canPrepareLaunchAction || isHandoffPrepared}
                onClick={pageActions.prepareHandoffPrepared}
              />
            </div>
          </div>
        </WorkflowCard>
      </div>
    </details>
  );
}
