import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import {
  EXECUTOR_TYPE_LABELS,
  executorIntegrationAdapterExecutorHint,
  executorIntegrationAdapterPayloadSummary,
} from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { ExecutionConnectorView, ExecutionPageViews, ExecutionRunView } from "@/lib/workflow/executionViewState";
import type { ExecutionPageContentActions } from "./executionPageTypes";

export type ExecutionRunMonitoringSectionProps = {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  pageActions: ExecutionPageContentActions;
  runView: ExecutionRunView;
  connectorView: ExecutionConnectorView;
  recentEvents: ExecutionPageViews["runMeta"]["recentEvents"];
};

export function ExecutionRunMonitoringSection(props: ExecutionRunMonitoringSectionProps) {
  const { sessionId, pre, monitoring, actions, pageActions, runView, connectorView, recentEvents } = props;
  const {
    executorIntegrationAdapter,
    isExecutorIntegrationAdapterCurrent,
    executorConnectorResult,
    isExecutorConnectorResultCurrent,
  } = pre;

  return (
    <WorkflowCard padding={12}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>현재 실행·모니터링</div>
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>
        <span style={{ fontWeight: 900 }}>현재</span> 비즈니스 실행을 관찰하고, 실행 명령이 최신일 때 시작·재시도하며, 통합 봉투를 준비한 뒤 실행기 연결기를 호출합니다. 로컬 전용이며 저장소·PR·머지에 해당하는 환경 실행이 아닙니다.
      </div>
      {!sessionId ? (
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>실행 모니터링과 연결기를 쓰려면 세션을 선택하세요.</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {monitoring.staleRunView ? (
            <div
              style={{
                border: "1px dashed #d1d5db",
                borderRadius: 10,
                padding: 10,
                background: "#f9fafb",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "#6b7280" }}>이전 실행(현재 아님)</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                {monitoring.staleRunView.progressLabel} · <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.staleRunView.runId}</span>
              </div>
              {monitoring.hasStaleRunVersusCommand ? (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                  실행 명령이 최신입니다. 아래 <span style={{ fontWeight: 900 }}>{runView.businessRunRetryLabel}</span>을 사용하세요.
                </div>
              ) : null}
            </div>
          ) : null}

          {monitoring.view ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background:
                  monitoring.view.status === "failed"
                    ? "#fef2f2"
                    : monitoring.view.status === "completed"
                      ? "#f0fdf4"
                      : monitoring.view.status === "running"
                        ? "#eff6ff"
                        : "#fffbeb",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>실행 상태</div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 900 }}>{monitoring.view.progressLabel}</span> ·{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.runId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                명령 <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.launchCommandId}</span> · 실행기{" "}
                <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[monitoring.view.executorType]}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>{monitoring.view.latestMessage}</div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                시작 <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.startedAtIso}</span>
                {" · "}
                갱신 <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.updatedAtIso}</span>
              </div>
              {monitoring.view.finishedAtIso ? (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                  종료 <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.finishedAtIso}</span>
                </div>
              ) : null}
              {monitoring.view.resultSummary ? (
                <div style={{ fontSize: 11, color: "#166534", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>{monitoring.view.resultSummary}</div>
              ) : null}
              {monitoring.view.errorMessage ? (
                <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>{monitoring.view.errorMessage}</div>
              ) : null}
              {monitoring.view.note ? (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>메모: {monitoring.view.note}</div>
              ) : null}
            </div>
          ) : sessionId && !monitoring.staleRunView ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>이 세션에 기록된 비즈니스 실행이 없습니다.</div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowActionButton
              label="진행 중으로 표시"
              variant="secondary"
              disabled={!sessionId || !monitoring.canMarkRunning}
              onClick={() => pageActions.applyBusinessRunControl("running")}
            />
            <WorkflowActionButton
              label="완료로 표시"
              variant="secondary"
              disabled={!sessionId || !monitoring.canMarkCompleted}
              onClick={() => pageActions.applyBusinessRunControl("completed")}
            />
            <WorkflowActionButton
              label="실패로 표시"
              variant="secondary"
              disabled={!sessionId || !monitoring.canMarkFailed}
              onClick={() => pageActions.applyBusinessRunControl("failed")}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>비즈니스 실행 시작·재시도</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
              <span style={{ fontWeight: 900 }}>현재 실행 명령</span>에서만 최신 추적 비즈니스 실행을 만듭니다. 저장소·PR 환경 실행이 아닙니다.
            </div>
            {runView.businessRunRetryBlocked ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                현재 명령에 대한 실행이 이미 진행 중입니다. 다른 실행을 시작하기 전에 종료 처리하거나 단말 상태로 표시하세요.
              </div>
            ) : null}
            <WorkflowActionButton
              label={actions.invocationPrimaryLabel}
              variant="primary"
              disabled={!sessionId || !actions.canStartBusinessExecution}
              onClick={pageActions.startBusinessExecution}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>실행기 통합 어댑터</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
              <span style={{ fontWeight: 900 }}>현재</span> 비즈니스 실행을 구조화된 통합 봉투로 만듭니다. 산출물만 해당합니다.
            </div>
            {isExecutorIntegrationAdapterCurrent && executorIntegrationAdapter ? (
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.45, fontStyle: "italic" }}>
                {executorIntegrationAdapterPayloadSummary(executorIntegrationAdapter.adapterPayload)}
                <br />
                힌트: {executorIntegrationAdapterExecutorHint(executorIntegrationAdapter.adapterPayload)}
              </div>
            ) : null}
            <WorkflowActionButton
              label="통합 어댑터 준비"
              variant="primary"
              disabled={!sessionId || !actions.canPrepareExecutorIntegrationAdapter}
              onClick={pageActions.prepareExecutorIntegrationAdapter}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>실행기 연결기</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
              <span style={{ fontWeight: 900 }}>cursor_executor</span>는 Cursor 파일럿, <span style={{ fontWeight: 900 }}>reviewer</span>는 리뷰어 파일럿입니다.{" "}
              <span style={{ fontWeight: 900 }}>SCM</span>과 <span style={{ fontWeight: 900 }}>security</span>는 <span style={{ fontWeight: 900 }}>스텁</span>입니다.
            </div>
            {!isExecutorIntegrationAdapterCurrent || !executorIntegrationAdapter ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                <span style={{ fontWeight: 900 }}>현재</span> 통합 어댑터가 있어야 연결기를 사용할 수 있습니다.
              </div>
            ) : null}
            {connectorView.connectorStaleNote ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>{connectorView.connectorStaleNote}</div>
            ) : null}
            {isExecutorConnectorResultCurrent && executorConnectorResult ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  background:
                    executorConnectorResult.status === "failed"
                      ? "#fef2f2"
                      : executorConnectorResult.status === "completed"
                        ? "#f0fdf4"
                        : executorConnectorResult.status === "running"
                          ? "#eff6ff"
                          : "#fffbeb",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>연결기 상태</div>
                {executorConnectorResult.connectorType ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                    {executorConnectorResult.connectorType.startsWith("cursor_pilot")
                      ? "Cursor 파일럿 연결기"
                      : executorConnectorResult.connectorType.startsWith("reviewer_pilot")
                        ? "리뷰어 파일럿 연결기"
                        : "스텁 연결기"}{" "}
                    · <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.connectorType}</span>
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 900 }}>
                    {executorConnectorResult.status === "accepted"
                      ? "연결기 수락"
                      : executorConnectorResult.status === "running"
                        ? "진행 중"
                        : executorConnectorResult.status === "completed"
                          ? "완료"
                          : "실패"}
                  </span>{" "}
                  · 실행 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.connectorRunId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                  어댑터 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.integrationAdapterId}</span> · 실행기{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorConnectorResult.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                  시작 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.startedAtIso}</span>
                </div>
                {executorConnectorResult.finishedAtIso ? (
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                    종료 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.finishedAtIso}</span>
                  </div>
                ) : null}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>{executorConnectorResult.message}</div>
                {executorConnectorResult.resultSummary ? (
                  <div style={{ fontSize: 11, color: "#166534", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                    {executorConnectorResult.resultSummary}
                  </div>
                ) : null}
                {executorConnectorResult.errorCode ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                    오류코드 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.errorCode}</span>
                  </div>
                ) : null}
                {executorConnectorResult.errorMessage ? (
                  <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                    {executorConnectorResult.errorMessage}
                  </div>
                ) : null}
              </div>
            ) : sessionId && isExecutorIntegrationAdapterCurrent && executorIntegrationAdapter ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                현재 통합 어댑터에 대한 연결기 결과가 아직 없습니다.
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <WorkflowActionButton
                label="연결기 호출"
                variant="primary"
                disabled={!sessionId || !actions.canInvokeExecutorConnector}
                onClick={pageActions.runExecutorConnector}
              />
              <WorkflowActionButton
                label="연결기 다시 시도"
                variant="secondary"
                disabled={!sessionId || !actions.canRetryExecutorConnector}
                onClick={pageActions.retryExecutorConnector}
              />
            </div>
          </div>

          {monitoring.view ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>최근 실행 이벤트</div>
              {recentEvents.length === 0 ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>기록된 실행 이벤트가 아직 없습니다.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {recentEvents.map((e) => (
                    <div
                      key={e.eventId}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "baseline",
                        padding: "6px 8px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#ffffff",
                      }}
                    >
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7280", minWidth: 170 }}>{e.createdAtIso}</div>
                      <div style={{ fontSize: 12, color: "#111827", lineHeight: 1.4, flex: 1 }}>{e.message}</div>
                      {e.errorCode ? (
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7280" }}>{e.errorCode}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </WorkflowCard>
  );
}
