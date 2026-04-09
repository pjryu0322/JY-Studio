import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import {
  actualExecutionAdapterExecutorHintPreview,
  actualExecutionAdapterPayloadSummary,
  actualLaunchCommandExecutorHintPreview,
  actualLaunchCommandPayloadSummary,
  executorLaunchContractContextSummary,
  executorLaunchHintsPreview,
  executorIntakePreviewLine,
  EXECUTION_EXECUTOR_TYPES,
  EXECUTOR_TYPE_LABELS,
  truncateWorkOrderPreview,
  executorIntegrationAdapterExecutorHint,
  executorIntegrationAdapterPayloadSummary,
} from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { BusinessExecutionRunEvent } from "@/lib/workflow/businessExecutionRunEvent";
import { getExecutionRunMonitoringView, getExecutionSummaryView, type ExecutionTone } from "@/components/workflow/execution/executionPageViewModels";

export type ExecutionPageContentActions = {
  openTasks: () => void;
  selectActiveInput: () => void;
  prepareHandoffPrepared: () => void;
  createExecutionRequestDraft: () => void;
  approveExecutionDraft: () => void;
  recordBusinessExecutionRequest: () => void;
  approveBusinessExecution: () => void;
  createBusinessExecutionPackage: () => void;
  assignExecutor: (executorType: (typeof EXECUTION_EXECUTOR_TYPES)[number]) => void;
  prepareExecutorHandoffPayload: () => void;
  prepareExecutorIntakeContract: () => void;
  prepareExecutorWorkOrder: () => void;
  declareLaunchIntent: () => void;
  prepareLaunchHandoffRecord: () => void;
  prepareExecutionBridge: () => void;
  prepareExecutorLaunchContract: () => void;
  markExecutionTriggerIntent: () => void;
  prepareActualExecutionAdapter: () => void;
  prepareActualLaunchCommand: () => void;
  startBusinessExecution: () => void;
  applyBusinessRunControl: (status: "running" | "completed" | "failed") => void;
  prepareExecutorIntegrationAdapter: () => void;
  runExecutorConnector: () => void;
  retryExecutorConnector: () => void;
};

export type ExecutionPageContentProps = {
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
  timeline: { events: BusinessExecutionRunEvent[] };
  pageActions: ExecutionPageContentActions;
};

function inlineKpi(label: string, value: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral") {
  const color =
    tone === "good" ? "#166534" : tone === "warn" ? "#b45309" : tone === "bad" ? "#b91c1c" : "#111827";
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

export function ExecutionPageContent(props: ExecutionPageContentProps) {
  const { sessionId, requirementId, pre, monitoring, actions, nextAction, timeline, pageActions } = props;

  const snapshot = pre.snapshot;
  const isActive = pre.isSnapshotActive;
  const launchReadiness = pre.launchReadiness;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffPrepared = pre.handoffPrepared;
  const snapshotStaleness = pre.snapshotStaleness;
  const handoffValidity = pre.handoffValidity;

  const executionRequestDraft = pre.executionRequestDraft;
  const executionRequestApproval = pre.executionRequestApproval;
  const isDraftApproved = pre.isExecutionDraftApproved;

  const businessExecutionRequest = pre.businessExecutionRequest;
  const bizReqValidity = pre.businessExecutionRequestValidity;
  const businessExecutionApproval = pre.businessExecutionApproval;
  const isBusinessExecutionApproved = pre.isBusinessExecutionApproved;
  const businessExecutionPackage = pre.businessExecutionPackage;
  const isBusinessExecutionPackaged = pre.isBusinessExecutionPackaged;
  const executionAssignment = pre.executionAssignment;
  const isExecutionPackageAssigned = pre.isExecutionPackageAssigned;

  const executionAssignmentHandoffPayload = pre.executionAssignmentHandoffPayload;
  const isExecutionAssignmentHandoffCurrent = pre.isExecutionAssignmentHandoffCurrent;
  const executorIntakeContract = pre.executorIntakeContract;
  const isExecutorIntakeContractCurrent = pre.isExecutorIntakeContractCurrent;
  const executorWorkOrder = pre.executorWorkOrder;
  const isExecutorWorkOrderCurrent = pre.isExecutorWorkOrderCurrent;
  const executionReadiness = pre.executionReadiness;

  const businessLaunchIntent = pre.businessLaunchIntent;
  const isBusinessLaunchIntentCurrent = pre.isBusinessLaunchIntentCurrent;
  const businessLaunchHandoffRecord = pre.businessLaunchHandoffRecord;
  const isBusinessLaunchHandoffRecordCurrent = pre.isBusinessLaunchHandoffRecordCurrent;
  const executionBridgePayload = pre.executionBridgePayload;
  const isExecutionBridgePayloadCurrent = pre.isExecutionBridgePayloadCurrent;
  const executorLaunchContract = pre.executorLaunchContract;
  const isExecutorLaunchContractCurrent = pre.isExecutorLaunchContractCurrent;
  const executionTriggerIntent = pre.executionTriggerIntent;
  const isExecutionTriggerIntentCurrent = pre.isExecutionTriggerIntentCurrent;
  const actualExecutionAdapterRequest = pre.actualExecutionAdapterRequest;
  const isActualExecutionAdapterRequestCurrent = pre.isActualExecutionAdapterRequestCurrent;
  const actualLaunchCommand = pre.actualLaunchCommand;
  const isActualLaunchCommandCurrent = pre.isActualLaunchCommandCurrent;

  const businessExecutionRun = pre.businessExecutionRun;
  const isBusinessExecutionRunCurrent = pre.isBusinessExecutionRunCurrent;

  const executorIntegrationAdapter = pre.executorIntegrationAdapter;
  const isExecutorIntegrationAdapterCurrent = pre.isExecutorIntegrationAdapterCurrent;
  const executorConnectorResult = pre.executorConnectorResult;
  const isExecutorConnectorResultCurrent = pre.isExecutorConnectorResultCurrent;

  const summary = getExecutionSummaryView({
    sessionId,
    requirementId,
    pre,
    monitoring,
    actions,
    nextAction,
  });

  const runMonitoringView = getExecutionRunMonitoringView({ sessionId, monitoring, timeline });

  function toneOrNeutral(tone: ExecutionTone | undefined): ExecutionTone {
    return tone ?? "neutral";
  }

  return (
    <div>
      <WorkflowPageHeader
        title="Execution"
        subtitle="Business execution only (not Stage1/Stage2)"
        backHref="/workspace"
        backLabel="Back to workspace"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Current execution status</div>
          {!sessionId ? (
            <WorkflowEmptyState
              title="No session selected"
              message="Add ?sessionId= (and optionally ?requirementId=) to view execution status for a session."
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {summary.contextLine ? <div style={{ fontSize: 12, color: "#6b7280" }}>{summary.contextLine}</div> : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {summary.kpis.map((k) => inlineKpi(k.label, k.value, toneOrNeutral(k.tone)))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <WorkflowActionButton label="Open Tasks workspace" variant="secondary" onClick={pageActions.openTasks} />
                {summary.primaryAction.key === "none" ? (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{summary.primaryAction.note ?? "Up to date."}</div>
                ) : (
                  <WorkflowActionButton
                    label={summary.primaryAction.label}
                    variant="primary"
                    disabled={summary.primaryAction.disabled}
                    onClick={() => {
                      const key = summary.primaryAction.key;
                      if (key === "openTasks") pageActions.openTasks();
                      else if (key === "selectActiveInput") pageActions.selectActiveInput();
                      else if (key === "prepareHandoffPrepared") pageActions.prepareHandoffPrepared();
                      else if (key === "createExecutionRequestDraft") pageActions.createExecutionRequestDraft();
                      else if (key === "approveExecutionDraft") pageActions.approveExecutionDraft();
                      else if (key === "recordBusinessExecutionRequest") pageActions.recordBusinessExecutionRequest();
                      else if (key === "approveBusinessExecution") pageActions.approveBusinessExecution();
                      else if (key === "createBusinessExecutionPackage") pageActions.createBusinessExecutionPackage();
                      else if (key === "startBusinessExecution") pageActions.startBusinessExecution();
                      else if (key === "prepareExecutorIntegrationAdapter") pageActions.prepareExecutorIntegrationAdapter();
                      else if (key === "runExecutorConnector") pageActions.runExecutorConnector();
                    }}
                  />
                )}
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

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Current run</div>

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution monitoring</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
              Observe and lightly control the <span style={{ fontWeight: 900 }}>current</span> business run. Local-only — not executor telemetry, not Stage1/Stage2, not
              environment tests.
            </div>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to view run monitoring.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {monitoring.staleRunView ? (
                  <div
                    style={{
                      border: "1px dashed #d1d5db",
                      borderRadius: 10,
                      padding: 10,
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#6b7280" }}>Previous run (not current)</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                      {monitoring.staleRunView.progressLabel} ·{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.staleRunView.runId}</span>
                    </div>
                    {monitoring.hasStaleRunVersusCommand ? (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                        Launch command is current — you can <span style={{ fontWeight: 900 }}>Retry</span> in “Start / Retry run”.
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
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Current run</div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                      Run status <span style={{ fontWeight: 900 }}>{monitoring.view.progressLabel}</span> ·{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.runId}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                      command{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.launchCommandId}</span> · executor{" "}
                      <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[monitoring.view.executorType]}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>{monitoring.view.latestMessage}</div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                      started <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.startedAtIso}</span>
                      {" · "}
                      updated <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.updatedAtIso}</span>
                    </div>
                    {monitoring.view.finishedAtIso ? (
                      <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                        finished <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.finishedAtIso}</span>
                      </div>
                    ) : null}
                    {monitoring.view.resultSummary ? (
                      <div style={{ fontSize: 11, color: "#166534", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                        {monitoring.view.resultSummary}
                      </div>
                    ) : null}
                    {monitoring.view.errorMessage ? (
                      <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                        {monitoring.view.errorMessage}
                      </div>
                    ) : null}
                    {monitoring.view.note ? (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>Note: {monitoring.view.note}</div>
                    ) : null}
                  </div>
                ) : sessionId && !monitoring.staleRunView ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution run on file for this session.</div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <WorkflowActionButton
                    label="Mark running"
                    variant="secondary"
                    disabled={!sessionId || !monitoring.canMarkRunning}
                    onClick={() => pageActions.applyBusinessRunControl("running")}
                  />
                  <WorkflowActionButton
                    label="Mark completed"
                    variant="secondary"
                    disabled={!sessionId || !monitoring.canMarkCompleted}
                    onClick={() => pageActions.applyBusinessRunControl("completed")}
                  />
                  <WorkflowActionButton
                    label="Mark failed"
                    variant="secondary"
                    disabled={!sessionId || !monitoring.canMarkFailed}
                    onClick={() => pageActions.applyBusinessRunControl("failed")}
                  />
                </div>

                {monitoring.view ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Recent execution events</div>
                    {runMonitoringView.recentEvents.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No run events recorded yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {runMonitoringView.recentEvents.map((e) => (
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
                            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7280", minWidth: 170 }}>
                              {e.createdAtIso}
                            </div>
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

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor connector</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
              Cursor pilot for <span style={{ fontWeight: 900 }}>cursor_executor</span> and Reviewer pilot for <span style={{ fontWeight: 900 }}>reviewer</span>.{" "}
              <span style={{ fontWeight: 900 }}>SCM</span> and <span style={{ fontWeight: 900 }}>security</span> stay <span style={{ fontWeight: 900 }}>stubbed</span>. Not
              Stage1/Stage2. No Git/PR/merge.
            </div>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session for connector invocation.</div>
            ) : !isExecutorIntegrationAdapterCurrent || !executorIntegrationAdapter ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Connector unavailable until a <span style={{ fontWeight: 900 }}>current</span> integration adapter exists.
              </div>
            ) : null}
            {actions.hasStaleExecutorConnectorResult ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                A stored connector result no longer matches the current integration adapter. Invoke again after the adapter is current.
              </div>
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
                <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Connector status</div>
                {executorConnectorResult.connectorType ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                    {executorConnectorResult.connectorType.startsWith("cursor_pilot")
                      ? "Cursor pilot connector"
                      : executorConnectorResult.connectorType.startsWith("reviewer_pilot")
                        ? "Reviewer pilot connector"
                        : "Stub connector"}{" "}
                    · <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.connectorType}</span>
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 900 }}>
                    {executorConnectorResult.status === "accepted"
                      ? "Connector accepted"
                      : executorConnectorResult.status === "running"
                        ? "Running"
                        : executorConnectorResult.status === "completed"
                          ? "Completed"
                          : "Failed"}
                  </span>{" "}
                  · run <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.connectorRunId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                  adapter <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.integrationAdapterId}</span> · executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorConnectorResult.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                  started <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.startedAtIso}</span>
                </div>
                {executorConnectorResult.finishedAtIso ? (
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                    finished <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.finishedAtIso}</span>
                  </div>
                ) : null}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  {executorConnectorResult.message}
                </div>
                {executorConnectorResult.resultSummary ? (
                  <div style={{ fontSize: 11, color: "#166534", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                    {executorConnectorResult.resultSummary}
                  </div>
                ) : null}
                {executorConnectorResult.errorCode ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                    errorCode <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.errorCode}</span>
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
                No connector result for this current integration adapter yet.
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <WorkflowActionButton
                label="Invoke connector"
                variant="primary"
                disabled={!sessionId || !actions.canInvokeExecutorConnector}
                onClick={pageActions.runExecutorConnector}
              />
              <WorkflowActionButton
                label="Retry"
                variant="secondary"
                disabled={!sessionId || !actions.canRetryExecutorConnector}
                onClick={pageActions.retryExecutorConnector}
              />
            </div>
          </WorkflowCard>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Execution progress</div>

          <details open style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Execution request</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
              {/* Draft */}
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution request draft</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Draft is a structured request payload. Creating a draft does not start execution.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {executionRequestDraft ? (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Draft prepared</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        status <span style={{ fontWeight: 900 }}>draft</span> • request{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.requestId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        snapshot <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.snapshotId}</span> • candidates{" "}
                        <span style={{ fontWeight: 900 }}>{executionRequestDraft.readyTaskIds.length}</span> • created{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.createdAtIso}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No draft prepared yet.</div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label="Create execution draft"
                      variant="primary"
                      disabled={!handoffValidity.isHandoffValid || !isHandoffPrepared || !snapshot || Boolean(executionRequestDraft)}
                      onClick={pageActions.createExecutionRequestDraft}
                    />
                    {!handoffValidity.isHandoffValid ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              {/* Draft approval */}
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Final pre-launch checkpoint</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Approval is a local checkpoint for the current execution draft. It does not start execution.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {isDraftApproved && executionRequestApproval ? (
                    <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>Approved for future launch</div>
                      <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
                        request <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.requestId}</span> • approved{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.approvedAtIso}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Not approved yet.</div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isDraftApproved ? "Approved" : "Approve for launch"}
                      variant="primary"
                      disabled={!executionRequestDraft || !handoffValidity.isHandoffValid || isDraftApproved}
                      onClick={pageActions.approveExecutionDraft}
                    />
                    {!executionRequestDraft || !handoffValidity.isHandoffValid ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              {/* Business request */}
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution request</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Business-side request only (not Stage1/Stage2). Lifecycle is computed from the current snapshot and task sets.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {businessExecutionRequest && bizReqValidity ? (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Requested work package</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        Request status:{" "}
                        {bizReqValidity.status === "requested" ? (
                          <span style={{ fontWeight: 900, color: "#166534" }}>Requested</span>
                        ) : bizReqValidity.status === "stale" ? (
                          <span style={{ fontWeight: 900, color: "#b45309" }}>Stale</span>
                        ) : (
                          <span style={{ fontWeight: 900, color: "#b45309" }}>Invalid</span>
                        )}{" "}
                        • id <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.requestId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        session <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.sessionId}</span> • snapshot{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.snapshotId}</span> • candidates{" "}
                        <span style={{ fontWeight: 900 }}>{businessExecutionRequest.candidateTaskIds.length}</span> • created{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.createdAtIso}</span>
                      </div>
                      {bizReqValidity.status === "stale" && bizReqValidity.staleReason ? (
                        <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>{bizReqValidity.staleReason}</div>
                      ) : null}
                      {bizReqValidity.status === "invalid" && bizReqValidity.invalidReason ? (
                        <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>{bizReqValidity.invalidReason}</div>
                      ) : null}
                      {actions.businessRequestNeedsAttention ? (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                          Re-prepare snapshot in /tasks if needed, then use Recreate request.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution request yet.</div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!businessExecutionRequest ? (
                      <WorkflowActionButton
                        label="Create execution request"
                        variant="primary"
                        disabled={!actions.canRecordBusinessRequest}
                        onClick={pageActions.recordBusinessExecutionRequest}
                      />
                    ) : null}
                    {businessExecutionRequest && actions.businessRequestNeedsAttention ? (
                      <WorkflowActionButton
                        label="Recreate request"
                        variant="primary"
                        disabled={!actions.canRecordBusinessRequest}
                        onClick={pageActions.recordBusinessExecutionRequest}
                      />
                    ) : null}
                    {!actions.canRecordBusinessRequest || actions.businessRequestNeedsAttention ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              {/* Business approval */}
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution approval</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Finalizes the current business execution request for tracking only. Does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to manage approval.</div>
                  ) : !businessExecutionRequest || !bizReqValidity ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution request yet.</div>
                  ) : !actions.businessRequestValid ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Approval unavailable while the request is{" "}
                      <span style={{ fontWeight: 900, color: "#b45309" }}>{bizReqValidity.status === "stale" ? "stale" : "invalid"}</span>.
                    </div>
                  ) : null}

                  {actions.hasOrphanBusinessApproval ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A prior approval exists for a different request snapshot and does not apply to the current request.
                    </div>
                  ) : null}

                  {isBusinessExecutionApproved && businessExecutionApproval ? (
                    <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>Approved for business execution</div>
                      <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
                        Status <span style={{ fontWeight: 900 }}>approved</span> • request{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.requestId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#15803d", marginTop: 4, lineHeight: 1.5 }}>
                        Approved <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.approvedAtIso}</span> • session{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.sessionId}</span> • snapshot{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.snapshotId}</span>
                      </div>
                    </div>
                  ) : sessionId && businessExecutionRequest && actions.businessRequestValid ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Not finalized yet.</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isBusinessExecutionApproved ? "Approved" : "Approve execution request"}
                      variant="primary"
                      disabled={!sessionId || !actions.canApproveBusinessExecution}
                      onClick={pageActions.approveBusinessExecution}
                    />
                    {sessionId && (!businessExecutionRequest || !actions.businessRequestValid) ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>
            </div>
          </details>

          <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Package and assignment</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution package</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Bundles the approved execution request into a stable work package. Does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to manage the execution package.</div>
                  ) : !isBusinessExecutionApproved ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Packaging unavailable until the request is <span style={{ fontWeight: 900 }}>approved</span>.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentPackage ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A stored package does not match the current approved request. Prepare again to replace it (latest only).
                    </div>
                  ) : null}
                  {isBusinessExecutionPackaged && businessExecutionPackage ? (
                    <div style={{ border: "1px solid #bfdbfe", borderRadius: 10, padding: 10, background: "#eff6ff" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#1e40af" }}>Execution package prepared</div>
                      <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 6, lineHeight: 1.5 }}>
                        Status <span style={{ fontWeight: 900 }}>packaged</span> • package{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.packageId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4, lineHeight: 1.5 }}>
                        session <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.sessionId}</span> • snapshot{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.snapshotId}</span> • candidates{" "}
                        <span style={{ fontWeight: 900 }}>{businessExecutionPackage.candidateTaskIds.length}</span> • created{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.createdAtIso}</span>
                      </div>
                    </div>
                  ) : sessionId && isBusinessExecutionApproved ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No package prepared yet.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isBusinessExecutionPackaged ? "Packaged" : "Prepare execution package"}
                      variant="primary"
                      disabled={!sessionId || !actions.canCreateBusinessPackage}
                      onClick={pageActions.createBusinessExecutionPackage}
                    />
                    {sessionId && !isBusinessExecutionApproved ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution assignment</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Records which executor role should handle the current package. Intent only — does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to assign an executor.</div>
                  ) : !isBusinessExecutionPackaged ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Assignment unavailable until an <span style={{ fontWeight: 900 }}>execution package</span> exists.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentAssignment ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A stored assignment targets a different package. Choose an executor again to update (latest only).
                    </div>
                  ) : null}
                  {isExecutionPackageAssigned && executionAssignment ? (
                    <div style={{ border: "1px solid #e9d5ff", borderRadius: 10, padding: 10, background: "#faf5ff" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#6b21a8" }}>Package assignment</div>
                      <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 6, lineHeight: 1.5 }}>
                        Status <span style={{ fontWeight: 900 }}>assigned</span> • assignment{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.assignmentId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, lineHeight: 1.5 }}>
                        executor <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionAssignment.executorType]}</span> (
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.executorType}</span>)
                      </div>
                    </div>
                  ) : sessionId && isBusinessExecutionPackaged ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No executor assigned yet.</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginTop: 4 }}>Assign executor</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {EXECUTION_EXECUTOR_TYPES.map((t) => (
                      <WorkflowActionButton
                        key={t}
                        label={EXECUTOR_TYPE_LABELS[t]}
                        variant={isExecutionPackageAssigned && executionAssignment?.executorType === t ? "primary" : undefined}
                        disabled={!sessionId || !actions.canAssignExecutor}
                        onClick={() => pageActions.assignExecutor(t)}
                      />
                    ))}
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor handoff payload</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Stable bundle for a future executor consumer from the current assignment. Does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a handoff payload.</div>
                  ) : !isExecutionPackageAssigned ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Handoff unavailable until the current package has a valid <span style={{ fontWeight: 900 }}>executor assignment</span>.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentHandoffPayload ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A stored handoff payload does not match the current assignment. Prepare again to replace it (latest only).
                    </div>
                  ) : null}
                  {isExecutionAssignmentHandoffCurrent && executionAssignmentHandoffPayload ? (
                    <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 10, background: "#fffbeb" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#9a3412" }}>Handoff ready</div>
                      <div style={{ fontSize: 12, color: "#c2410c", marginTop: 6, lineHeight: 1.5 }}>
                        Status <span style={{ fontWeight: 900 }}>handoff_ready</span> • handoff{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignmentHandoffPayload.handoffId}</span>
                      </div>
                    </div>
                  ) : sessionId && isExecutionPackageAssigned ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No handoff payload yet for this assignment.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isExecutionAssignmentHandoffCurrent ? "Handoff prepared" : "Prepare executor handoff"}
                      variant="primary"
                      disabled={!sessionId || !actions.canCreateHandoffPayload}
                      onClick={pageActions.prepareExecutorHandoffPayload}
                    />
                    {sessionId && !isExecutionPackageAssigned ? (
                      <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor intake contract</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Executor-facing structured input from the current handoff. Does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare an intake contract.</div>
                  ) : !isExecutionAssignmentHandoffCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Intake unavailable until a <span style={{ fontWeight: 900 }}>current handoff payload</span> exists.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentIntakeContract ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A stored intake contract does not match the current handoff. Prepare again to replace it (latest only).
                    </div>
                  ) : null}
                  {isExecutorIntakeContractCurrent && executorIntakeContract ? (
                    <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: 10, background: "#ecfdf5" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#065f46" }}>Intake prepared</div>
                      <div style={{ fontSize: 12, color: "#047857", marginTop: 6, lineHeight: 1.5 }}>
                        intake <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.intakeId}</span> •{" "}
                        <span style={{ fontStyle: "italic" }}>{executorIntakePreviewLine(executorIntakeContract)}</span>
                      </div>
                    </div>
                  ) : sessionId && isExecutionAssignmentHandoffCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No intake contract yet.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isExecutorIntakeContractCurrent ? "Intake prepared" : "Prepare executor input"}
                      variant="primary"
                      disabled={!sessionId || !actions.canCreateIntakeContract}
                      onClick={pageActions.prepareExecutorIntakeContract}
                    />
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor work order</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  Actionable instructions for the executor from the current intake. Does not start Stage1/Stage2.
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a work order.</div>
                  ) : !isExecutorIntakeContractCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      Work order unavailable until a <span style={{ fontWeight: 900 }}>current intake contract</span> exists.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentWorkOrder ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      A stored work order does not match the current intake. Prepare again to replace it (latest only).
                    </div>
                  ) : null}
                  {isExecutorWorkOrderCurrent && executorWorkOrder ? (
                    <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, padding: 10, background: "#eef2ff" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#3730a3" }}>Work order prepared</div>
                      <div style={{ fontSize: 11, color: "#6366f1", marginTop: 6, lineHeight: 1.45 }}>
                        Objective: {truncateWorkOrderPreview(executorWorkOrder.objective, 96)}
                      </div>
                      <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4, lineHeight: 1.45 }}>
                        Success: {truncateWorkOrderPreview(executorWorkOrder.successCriteria, 96)}
                      </div>
                    </div>
                  ) : sessionId && isExecutorIntakeContractCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No work order yet.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isExecutorWorkOrderCurrent ? "Work order prepared" : "Prepare executor work order"}
                      variant="primary"
                      disabled={!sessionId || !actions.canCreateWorkOrder}
                      onClick={pageActions.prepareExecutorWorkOrder}
                    />
                  </div>
                </div>
              </WorkflowCard>
            </div>
          </details>
        </div>

        <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Advanced details (artifacts)</summary>
          <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
            {/* The remaining low-level artifact cards are intentionally kept accessible but visually secondary. */}
            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Prepared execution input</div>

              {!sessionId ? (
                <WorkflowEmptyState
                  title="No session selected"
                  message="Add ?sessionId= (and optionally ?requirementId=) to view a prepared snapshot for a specific session."
                />
              ) : snapshot ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Snapshot exists for this session. Execution is not started; this is a read-only pre-execution input source.
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Active input:{" "}
                    {isActive ? (
                      <span style={{ fontWeight: 900, color: "#166534" }}>Selected</span>
                    ) : pre.active ? (
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>
                        {pre.active.sessionId} / {pre.active.snapshotId}
                      </span>
                    ) : (
                      <span>(none)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                    <span style={{ fontWeight: 900 }}>{snapshot.summary.candidateCount}</span> candidates • snapshot{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.snapshotId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    sessionId: <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.sessionId}</span> • requirementId:{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.requirementId ?? "(none)"}</span> • preparedAt:{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.preparedAtIso}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isActive ? "Active input selected" : "Select as active input"}
                      variant="primary"
                      onClick={pageActions.selectActiveInput}
                      disabled={isActive}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    No prepared execution snapshot for this session yet. Prepare it in the Tasks workspace first.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={pageActions.openTasks} />
                  </div>
                </div>
              )}

              {sessionId ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <WorkflowActionButton label="Open Tasks workspace" onClick={pageActions.openTasks} />
                </div>
              ) : null}
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch readiness</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Pre-launch validation checkpoint for the active prepared input. No execution is triggered here.
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, color: "#111827" }}>
                  Status:{" "}
                  {launchReadiness.isLaunchReady ? (
                    <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
                  ) : (
                    <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
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
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Next action (raw)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {isHandoffPrepared && handoffPrepared ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 900, color: "#166534" }}>Handoff prepared</span> • preparedAt{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span> • snapshot{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.snapshotId}</span>
                  </div>
                ) : null}
                {snapshot ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    Snapshot:{" "}
                    {snapshotStaleness.isSnapshotStale ? (
                      <span style={{ fontWeight: 900, color: "#b45309" }}>Stale</span>
                    ) : (
                      <span style={{ fontWeight: 900, color: "#166534" }}>Current</span>
                    )}
                    {snapshotStaleness.isSnapshotStale && snapshotStaleness.staleReason ? ` • ${snapshotStaleness.staleReason}` : ""}
                  </div>
                ) : null}
                {isHandoffPrepared ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    Handoff validity:{" "}
                    {handoffValidity.isHandoffValid ? (
                      <span style={{ fontWeight: 900, color: "#166534" }}>Valid</span>
                    ) : (
                      <span style={{ fontWeight: 900, color: "#b45309" }}>Invalid</span>
                    )}
                    {!handoffValidity.isHandoffValid && handoffValidity.invalidReason ? ` • ${handoffValidity.invalidReason}` : ""}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <WorkflowActionButton
                    label={isHandoffPrepared ? "Handoff prepared" : nextAction.actionLabel}
                    variant="primary"
                    disabled={!nextAction.canPrepareLaunchAction || isHandoffPrepared}
                    onClick={pageActions.prepareHandoffPrepared}
                  />
                </div>
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution readiness</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Derived check only — does not start execution or Stage1/Stage2.</div>
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, color: "#111827" }}>
                  Status:{" "}
                  {executionReadiness.status === "ready" ? (
                    <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
                  ) : (
                    <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
                  )}
                </div>
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch intent</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <WorkflowActionButton
                  label={isBusinessLaunchIntentCurrent ? "Intent declared" : "Declare launch intent"}
                  variant="primary"
                  disabled={!sessionId || !actions.canDeclareLaunchIntent}
                  onClick={pageActions.declareLaunchIntent}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch handoff</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <WorkflowActionButton
                  label={isBusinessLaunchHandoffRecordCurrent ? "Handoff recorded" : "Prepare launch handoff record"}
                  variant="primary"
                  disabled={!sessionId || !actions.canRecordLaunchHandoff}
                  onClick={pageActions.prepareLaunchHandoffRecord}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution bridge</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <WorkflowActionButton
                  label={isExecutionBridgePayloadCurrent ? "Bridge ready" : "Prepare execution bridge"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutionBridge}
                  onClick={pageActions.prepareExecutionBridge}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor launch contract</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {isExecutorLaunchContractCurrent && executorLaunchContract ? (
                  <div style={{ fontSize: 11, color: "#0e7490", lineHeight: 1.45, fontStyle: "italic" }}>
                    Context: {executorLaunchContractContextSummary(executorLaunchContract)}
                    <br />
                    Launch hints: {executorLaunchHintsPreview(executorLaunchContract.launchHints)}…
                  </div>
                ) : null}
                <WorkflowActionButton
                  label={isExecutorLaunchContractCurrent ? "Contract ready" : "Prepare launch contract"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareLaunchContract}
                  onClick={pageActions.prepareExecutorLaunchContract}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution trigger intent</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <WorkflowActionButton
                  label={isExecutionTriggerIntentCurrent ? "Trigger intent declared" : "Declare trigger intent"}
                  variant="primary"
                  disabled={!sessionId || !actions.canDeclareExecutionTriggerIntent}
                  onClick={pageActions.markExecutionTriggerIntent}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Actual execution adapter</div>
              {isActualExecutionAdapterRequestCurrent && actualExecutionAdapterRequest ? (
                <div style={{ fontSize: 11, color: "#2563eb", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  Payload: {actualExecutionAdapterPayloadSummary(actualExecutionAdapterRequest)}
                  <br />
                  Hint: {actualExecutionAdapterExecutorHintPreview(actualExecutionAdapterRequest)}
                </div>
              ) : null}
              <div style={{ marginTop: 10 }}>
                <WorkflowActionButton
                  label={isActualExecutionAdapterRequestCurrent ? "Adapter ready" : "Prepare execution adapter"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutionAdapter}
                  onClick={pageActions.prepareActualExecutionAdapter}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Actual launch command</div>
              {isActualLaunchCommandCurrent && actualLaunchCommand ? (
                <div style={{ fontSize: 11, color: "#059669", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  Command: {actualLaunchCommandPayloadSummary(actualLaunchCommand)}
                  <br />
                  Hint: {actualLaunchCommandExecutorHintPreview(actualLaunchCommand)}
                </div>
              ) : null}
              <div style={{ marginTop: 10 }}>
                <WorkflowActionButton
                  label={isActualLaunchCommandCurrent ? "Command ready" : "Prepare launch command"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareLaunchCommand}
                  onClick={pageActions.prepareActualLaunchCommand}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Start / retry run</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Creates the latest tracked business-side run from the <span style={{ fontWeight: 900 }}>current launch command</span> only. Not Stage1/Stage2. Not Git.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <WorkflowActionButton
                  label={actions.invocationPrimaryLabel}
                  variant="primary"
                  disabled={!sessionId || !actions.canStartBusinessExecution}
                  onClick={pageActions.startBusinessExecution}
                />
              </div>
            </WorkflowCard>

            <WorkflowCard padding={12}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor integration</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
                Turn the <span style={{ fontWeight: 900 }}>current</span> business execution run into a structured integration envelope. Artifact only.
              </div>
              {isExecutorIntegrationAdapterCurrent && executorIntegrationAdapter ? (
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.45, fontStyle: "italic" }}>
                  {executorIntegrationAdapterPayloadSummary(executorIntegrationAdapter.adapterPayload)}
                  <br />
                  Hint: {executorIntegrationAdapterExecutorHint(executorIntegrationAdapter.adapterPayload)}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <WorkflowActionButton
                  label="Prepare integration adapter"
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutorIntegrationAdapter}
                  onClick={pageActions.prepareExecutorIntegrationAdapter}
                />
              </div>
            </WorkflowCard>
          </div>
        </details>
      </div>
    </div>
  );
}

