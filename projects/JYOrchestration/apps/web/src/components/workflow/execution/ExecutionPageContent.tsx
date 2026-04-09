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
import type { ExecutionPageViews, ExecutionPrimaryActionKey, ExecutionTone } from "@/lib/workflow/executionViewState";

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
  views: ExecutionPageViews;
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

function dispatchPrimaryExecutionAction(key: ExecutionPrimaryActionKey, pageActions: ExecutionPageContentActions) {
  if (key === "openTasks") pageActions.openTasks();
  else if (key === "selectActiveInput") pageActions.selectActiveInput();
  else if (key === "prepareHandoffPrepared") pageActions.prepareHandoffPrepared();
  else if (key === "createExecutionRequestDraft") pageActions.createExecutionRequestDraft();
  else if (key === "approveExecutionDraft") pageActions.approveExecutionDraft();
  else if (key === "recordBusinessExecutionRequest") pageActions.recordBusinessExecutionRequest();
  else if (key === "approveBusinessExecution") pageActions.approveBusinessExecution();
  else if (key === "createBusinessExecutionPackage") pageActions.createBusinessExecutionPackage();
  else if (key === "prepareExecutorHandoffPayload") pageActions.prepareExecutorHandoffPayload();
  else if (key === "prepareExecutorIntakeContract") pageActions.prepareExecutorIntakeContract();
  else if (key === "prepareExecutorWorkOrder") pageActions.prepareExecutorWorkOrder();
  else if (key === "declareLaunchIntent") pageActions.declareLaunchIntent();
  else if (key === "prepareLaunchHandoffRecord") pageActions.prepareLaunchHandoffRecord();
  else if (key === "prepareExecutionBridge") pageActions.prepareExecutionBridge();
  else if (key === "prepareExecutorLaunchContract") pageActions.prepareExecutorLaunchContract();
  else if (key === "markExecutionTriggerIntent") pageActions.markExecutionTriggerIntent();
  else if (key === "prepareActualExecutionAdapter") pageActions.prepareActualExecutionAdapter();
  else if (key === "prepareActualLaunchCommand") pageActions.prepareActualLaunchCommand();
  else if (key === "startBusinessExecution") pageActions.startBusinessExecution();
  else if (key === "prepareExecutorIntegrationAdapter") pageActions.prepareExecutorIntegrationAdapter();
  else if (key === "runExecutorConnector") pageActions.runExecutorConnector();
  else if (key === "retryExecutorConnector") pageActions.retryExecutorConnector();
}

function progressRowView(row: ExecutionPageViews["progress"]["executionRequest"]) {
  const color =
    row.tone === "good" ? "#166534" : row.tone === "warn" ? "#b45309" : row.tone === "bad" ? "#b91c1c" : "#111827";
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{row.title}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{row.statusLabel}</div>
      {row.detail ? <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{row.detail}</div> : null}
    </div>
  );
}

export function ExecutionPageContent(props: ExecutionPageContentProps) {
  const { sessionId, requirementId, pre, monitoring, actions, nextAction, views, pageActions } = props;

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

  const summary = views.summary;
  const runView = views.run;
  const connectorView = views.connector;
  const recentEvents = views.runMeta.recentEvents;

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

              <div
                style={{
                  border: summary.primaryAction.key === "none" ? "1px solid #e5e7eb" : "2px solid #2563eb",
                  borderRadius: 12,
                  padding: 12,
                  background: summary.primaryAction.key === "none" ? "#fafafa" : "#eff6ff",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, color: "#1e40af", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  Next action
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <WorkflowActionButton label="Open Tasks workspace" variant="secondary" onClick={pageActions.openTasks} />
                  {summary.primaryAction.key === "none" ? (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{summary.primaryAction.note ?? "Up to date."}</div>
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

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Workflow progress</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
            High-level checkpoints. Detailed actions live under Workflow steps below; current run and connector monitoring stay above for visibility.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {progressRowView(views.progress.executionRequest)}
            {progressRowView(views.progress.packageAndAssignment)}
            {progressRowView(views.progress.executionPreparation)}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Current run & monitoring</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>
            Observe the <span style={{ fontWeight: 900 }}>current</span> business run, start or retry when the launch command is current, prepare the integration envelope, then
            invoke the executor connector. Local-only — not Stage1/Stage2, not Git/PR/merge.
          </div>
          {!sessionId ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to use run monitoring and the connector.</div>
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
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#6b7280" }}>Previous run (not current)</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                    {monitoring.staleRunView.progressLabel} · <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.staleRunView.runId}</span>
                  </div>
                  {monitoring.hasStaleRunVersusCommand ? (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>
                      Launch command is current — use <span style={{ fontWeight: 900 }}>{runView.businessRunRetryLabel}</span> below.
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
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Run status</div>
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 900 }}>{monitoring.view.progressLabel}</span> ·{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.runId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                    command <span style={{ fontFamily: "ui-monospace, monospace" }}>{monitoring.view.launchCommandId}</span> · executor{" "}
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
                    <div style={{ fontSize: 11, color: "#166534", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>{monitoring.view.resultSummary}</div>
                  ) : null}
                  {monitoring.view.errorMessage ? (
                    <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6, lineHeight: 1.45, fontStyle: "italic" }}>{monitoring.view.errorMessage}</div>
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

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Start / retry business run</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                  Creates the latest tracked business-side run from the <span style={{ fontWeight: 900 }}>current launch command</span> only. Not Stage1/Stage2. Not Git.
                </div>
                {runView.businessRunRetryBlocked ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                    A run is already in progress for the current command — finish or mark terminal before starting another.
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
                <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Executor integration adapter</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                  Turn the <span style={{ fontWeight: 900 }}>current</span> business execution run into a structured integration envelope. Artifact only.
                </div>
                {isExecutorIntegrationAdapterCurrent && executorIntegrationAdapter ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.45, fontStyle: "italic" }}>
                    {executorIntegrationAdapterPayloadSummary(executorIntegrationAdapter.adapterPayload)}
                    <br />
                    Hint: {executorIntegrationAdapterExecutorHint(executorIntegrationAdapter.adapterPayload)}
                  </div>
                ) : null}
                <WorkflowActionButton
                  label="Prepare integration adapter"
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutorIntegrationAdapter}
                  onClick={pageActions.prepareExecutorIntegrationAdapter}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Executor connector</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                  Cursor pilot for <span style={{ fontWeight: 900 }}>cursor_executor</span> and Reviewer pilot for <span style={{ fontWeight: 900 }}>reviewer</span>.{" "}
                  <span style={{ fontWeight: 900 }}>SCM</span> and <span style={{ fontWeight: 900 }}>security</span> stay <span style={{ fontWeight: 900 }}>stubbed</span>.
                </div>
                {!isExecutorIntegrationAdapterCurrent || !executorIntegrationAdapter ? (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
                    Connector unavailable until a <span style={{ fontWeight: 900 }}>current</span> integration adapter exists.
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
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>{executorConnectorResult.message}</div>
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
                    label="Retry connector"
                    variant="secondary"
                    disabled={!sessionId || !actions.canRetryExecutorConnector}
                    onClick={pageActions.retryExecutorConnector}
                  />
                </div>
              </div>

              {monitoring.view ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Recent run events</div>
                  {recentEvents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No run events recorded yet.</div>
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

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Workflow steps</div>

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
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Package & assignment</summary>
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
            </div>
          </details>

          <details open style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Execution preparation</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                Handoff through launch command, grouped into sub-steps. Expand a group when you are working on it — not Stage1/Stage2.
              </div>

              <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
                <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>Executor delivery (handoff → intake → work order)</summary>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Executor handoff payload</div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>Stable bundle from the current assignment. Does not start Stage1/Stage2.</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
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
                        <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 8, background: "#fffbeb" }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#9a3412" }}>Handoff ready</div>
                          <div style={{ fontSize: 11, color: "#c2410c", marginTop: 4, lineHeight: 1.45 }}>
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

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Executor intake contract</div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>Structured input from the current handoff. Does not start Stage1/Stage2.</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
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
                        <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: 8, background: "#ecfdf5" }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#065f46" }}>Intake prepared</div>
                          <div style={{ fontSize: 11, color: "#047857", marginTop: 4, lineHeight: 1.45 }}>
                            intake <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.intakeId}</span> •{" "}
                            <span style={{ fontStyle: "italic" }}>{executorIntakePreviewLine(executorIntakeContract)}</span>
                          </div>
                        </div>
                      ) : sessionId && isExecutionAssignmentHandoffCurrent ? (
                        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No intake contract yet.</div>
                      ) : null}
                      <WorkflowActionButton
                        label={isExecutorIntakeContractCurrent ? "Intake prepared" : "Prepare executor input"}
                        variant="primary"
                        disabled={!sessionId || !actions.canCreateIntakeContract}
                        onClick={pageActions.prepareExecutorIntakeContract}
                      />
                    </div>
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Executor work order</div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>Instructions from the current intake. Does not start Stage1/Stage2.</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
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
                        <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, padding: 8, background: "#eef2ff" }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#3730a3" }}>Work order prepared</div>
                          <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4, lineHeight: 1.45 }}>
                            Objective: {truncateWorkOrderPreview(executorWorkOrder.objective, 96)}
                          </div>
                          <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2, lineHeight: 1.45 }}>
                            Success: {truncateWorkOrderPreview(executorWorkOrder.successCriteria, 96)}
                          </div>
                        </div>
                      ) : sessionId && isExecutorIntakeContractCurrent ? (
                        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No work order yet.</div>
                      ) : null}
                      <WorkflowActionButton
                        label={isExecutorWorkOrderCurrent ? "Work order prepared" : "Prepare executor work order"}
                        variant="primary"
                        disabled={!sessionId || !actions.canCreateWorkOrder}
                        onClick={pageActions.prepareExecutorWorkOrder}
                      />
                    </div>
                  </WorkflowCard>
                </div>
              </details>

              <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
                <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>Launch readiness & records</summary>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Execution readiness</div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>Derived check only — does not start execution or Stage1/Stage2.</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, color: "#111827" }}>
                        Status:{" "}
                        {executionReadiness.status === "ready" ? (
                          <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
                        ) : (
                          <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
                        )}
                      </div>
                    </div>
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Launch intent</div>
                    <div style={{ marginTop: 8 }}>
                      <WorkflowActionButton
                        label={isBusinessLaunchIntentCurrent ? "Intent declared" : "Declare launch intent"}
                        variant="primary"
                        disabled={!sessionId || !actions.canDeclareLaunchIntent}
                        onClick={pageActions.declareLaunchIntent}
                      />
                    </div>
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Launch handoff record</div>
                    <div style={{ marginTop: 8 }}>
                      <WorkflowActionButton
                        label={isBusinessLaunchHandoffRecordCurrent ? "Handoff recorded" : "Prepare launch handoff record"}
                        variant="primary"
                        disabled={!sessionId || !actions.canRecordLaunchHandoff}
                        onClick={pageActions.prepareLaunchHandoffRecord}
                      />
                    </div>
                  </WorkflowCard>
                </div>
              </details>

              <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
                <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>Launch chain (bridge → command)</summary>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Execution bridge</div>
                    <WorkflowActionButton
                      label={isExecutionBridgePayloadCurrent ? "Bridge ready" : "Prepare execution bridge"}
                      variant="primary"
                      disabled={!sessionId || !actions.canPrepareExecutionBridge}
                      onClick={pageActions.prepareExecutionBridge}
                    />
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Executor launch contract</div>
                    {isExecutorLaunchContractCurrent && executorLaunchContract ? (
                      <div style={{ fontSize: 10, color: "#0e7490", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
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
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Execution trigger intent</div>
                    <WorkflowActionButton
                      label={isExecutionTriggerIntentCurrent ? "Trigger intent declared" : "Declare trigger intent"}
                      variant="primary"
                      disabled={!sessionId || !actions.canDeclareExecutionTriggerIntent}
                      onClick={pageActions.markExecutionTriggerIntent}
                    />
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Actual execution adapter</div>
                    {isActualExecutionAdapterRequestCurrent && actualExecutionAdapterRequest ? (
                      <div style={{ fontSize: 10, color: "#2563eb", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                        Payload: {actualExecutionAdapterPayloadSummary(actualExecutionAdapterRequest)}
                        <br />
                        Hint: {actualExecutionAdapterExecutorHintPreview(actualExecutionAdapterRequest)}
                      </div>
                    ) : null}
                    <WorkflowActionButton
                      label={isActualExecutionAdapterRequestCurrent ? "Adapter ready" : "Prepare execution adapter"}
                      variant="primary"
                      disabled={!sessionId || !actions.canPrepareExecutionAdapter}
                      onClick={pageActions.prepareActualExecutionAdapter}
                    />
                  </WorkflowCard>

                  <WorkflowCard padding={10}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Actual launch command</div>
                    {isActualLaunchCommandCurrent && actualLaunchCommand ? (
                      <div style={{ fontSize: 10, color: "#059669", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                        Command: {actualLaunchCommandPayloadSummary(actualLaunchCommand)}
                        <br />
                        Hint: {actualLaunchCommandExecutorHintPreview(actualLaunchCommand)}
                      </div>
                    ) : null}
                    <WorkflowActionButton
                      label={isActualLaunchCommandCurrent ? "Command ready" : "Prepare launch command"}
                      variant="primary"
                      disabled={!sessionId || !actions.canPrepareLaunchCommand}
                      onClick={pageActions.prepareActualLaunchCommand}
                    />
                  </WorkflowCard>
                </div>
              </details>
            </div>
          </details>
        </div>

        <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>Advanced details (diagnostics)</summary>
          <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
            {/* Snapshot, launch readiness gating, and raw pre-launch actions — secondary to the main process sections above. */}
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
          </div>
        </details>
      </div>
    </div>
  );
}

