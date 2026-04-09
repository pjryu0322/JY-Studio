"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import {
  approveBusinessExecutionRequest,
  assignBusinessExecutionPackage,
  createBusinessLaunchHandoffRecord,
  createExecutionBridgePayload,
  createExecutorLaunchContract,
  declareBusinessLaunchIntent,
  actualExecutionAdapterExecutorHintPreview,
  actualExecutionAdapterPayloadSummary,
  actualLaunchCommandExecutorHintPreview,
  actualLaunchCommandPayloadSummary,
  createActualExecutionAdapterRequest,
  createActualLaunchCommand,
  createExecutorIntegrationAdapter,
  declareExecutionTriggerIntent,
  invokeBusinessExecution,
  invokeExecutorConnector,
  markBusinessExecutionRunCompleted,
  markBusinessExecutionRunFailed,
  markBusinessExecutionRunRunning,
  executorLaunchContractContextSummary,
  executorLaunchHintsPreview,
  createBusinessExecutionPackage,
  createExecutionAssignmentHandoff,
  createExecutorIntakeContract,
  createExecutorWorkOrder,
  executorIntakePreviewLine,
  EXECUTION_EXECUTOR_TYPES,
  EXECUTOR_TYPE_LABELS,
  isBusinessApprovalForRequest,
  recordSessionBusinessExecutionApproval,
  recordSessionBusinessLaunchHandoffRecord,
  recordSessionBusinessLaunchIntent,
  recordSessionExecutionBridgePayload,
  recordSessionExecutorLaunchContract,
  recordSessionExecutionTriggerIntent,
  recordSessionActualExecutionAdapterRequest,
  recordSessionActualLaunchCommand,
  recordSessionBusinessExecutionRun,
  recordSessionExecutorConnectorResult,
  recordSessionExecutorIntegrationAdapter,
  recordSessionBusinessExecutionPackage,
  recordSessionBusinessExecutionRequest,
  recordSessionExecutionAssignment,
  recordSessionExecutionAssignmentHandoffPayload,
  recordSessionExecutorIntakeContract,
  recordSessionExecutorWorkOrder,
  recordSessionExecutionRequestDraft,
  recordSessionExecutionRequestApproval,
  recordSessionHandoffPrepared,
  setActiveExecutionInput,
  truncateWorkOrderPreview,
  executorIntegrationAdapterExecutorHint,
  executorIntegrationAdapterPayloadSummary,
  type ExecutionExecutorType,
} from "@/lib/workflow/collaborationSessionResultStore";
import { createBusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import { approveExecutionRequestDraft } from "@/lib/workflow/executionRequestApproval";
import { createExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
import { getPreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import { EXECUTION_READINESS_UI_REASONS_MAX } from "@/lib/workflow/executionReadiness";
import { getBusinessExecutionMonitoringStateForSessionFromPre } from "@/lib/workflow/businessExecutionRunMonitoring";
import { getPreExecutionStateForSession } from "@/lib/workflow/preExecutionSelectors";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export default function ExecutionPage() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const pre = useMemo(() => getPreExecutionStateForSession(sessionId), [sessionId, sessionResultsVersion]);
  const monitoring = useMemo(
    () => getBusinessExecutionMonitoringStateForSessionFromPre(sessionId, pre),
    [sessionId, sessionResultsVersion, pre]
  );
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
  const nextAction = useMemo(
    () =>
      getPreLaunchActionAvailability({
        active: pre.active,
        snapshot: snapshot,
        launchReadiness,
      }),
    [pre.active, snapshot, launchReadiness]
  );

  const canRecordBusinessRequest =
    Boolean(snapshot) && handoffValidity.isHandoffValid && isDraftApproved && isHandoffPrepared;
  const businessRequestNeedsAttention = bizReqValidity?.status === "stale" || bizReqValidity?.status === "invalid";
  const businessRequestValid = bizReqValidity?.status === "requested";
  const canApproveBusinessExecution =
    Boolean(businessExecutionRequest) && businessRequestValid && !isBusinessExecutionApproved;
  const hasOrphanBusinessApproval =
    Boolean(businessExecutionRequest && businessExecutionApproval) &&
    !isBusinessApprovalForRequest(businessExecutionRequest, businessExecutionApproval);
  const canCreateBusinessPackage = isBusinessExecutionApproved && !isBusinessExecutionPackaged;
  const hasNonCurrentPackage = Boolean(businessExecutionPackage) && !isBusinessExecutionPackaged;
  const canAssignExecutor = isBusinessExecutionPackaged;
  const hasNonCurrentAssignment = Boolean(executionAssignment) && !isExecutionPackageAssigned && isBusinessExecutionPackaged;
  const canCreateHandoffPayload = isExecutionPackageAssigned && !isExecutionAssignmentHandoffCurrent;
  const hasNonCurrentHandoffPayload =
    Boolean(executionAssignmentHandoffPayload) && !isExecutionAssignmentHandoffCurrent && isExecutionPackageAssigned;
  const canCreateIntakeContract = isExecutionAssignmentHandoffCurrent && !isExecutorIntakeContractCurrent;
  const hasNonCurrentIntakeContract =
    Boolean(executorIntakeContract) && !isExecutorIntakeContractCurrent && isExecutionAssignmentHandoffCurrent;
  const canCreateWorkOrder = isExecutorIntakeContractCurrent && !isExecutorWorkOrderCurrent;
  const hasNonCurrentWorkOrder =
    Boolean(executorWorkOrder) && !isExecutorWorkOrderCurrent && isExecutorIntakeContractCurrent;
  const canDeclareLaunchIntent = executionReadiness.status === "ready" && !isBusinessLaunchIntentCurrent;
  const hasNonCurrentLaunchIntent =
    Boolean(businessLaunchIntent) && !isBusinessLaunchIntentCurrent && executionReadiness.status === "ready";
  const canRecordLaunchHandoff = isBusinessLaunchIntentCurrent && !isBusinessLaunchHandoffRecordCurrent;
  const hasStaleLaunchHandoffRecord =
    Boolean(businessLaunchHandoffRecord) && !isBusinessLaunchHandoffRecordCurrent;
  const canPrepareExecutionBridge = isBusinessLaunchHandoffRecordCurrent && !isExecutionBridgePayloadCurrent;
  const hasStaleExecutionBridgePayload =
    Boolean(executionBridgePayload) && !isExecutionBridgePayloadCurrent;
  const canPrepareLaunchContract = isExecutionBridgePayloadCurrent && !isExecutorLaunchContractCurrent;
  const hasStaleExecutorLaunchContract =
    Boolean(executorLaunchContract) && !isExecutorLaunchContractCurrent;
  const canDeclareExecutionTriggerIntent = isExecutorLaunchContractCurrent && !isExecutionTriggerIntentCurrent;
  const hasStaleExecutionTriggerIntent =
    Boolean(executionTriggerIntent) && !isExecutionTriggerIntentCurrent;
  const canPrepareExecutionAdapter =
    isExecutionTriggerIntentCurrent && !isActualExecutionAdapterRequestCurrent;
  const hasStaleActualExecutionAdapterRequest =
    Boolean(actualExecutionAdapterRequest) && !isActualExecutionAdapterRequestCurrent;
  const canPrepareLaunchCommand =
    isActualExecutionAdapterRequestCurrent && !isActualLaunchCommandCurrent;
  const hasStaleActualLaunchCommand =
    Boolean(actualLaunchCommand) && !isActualLaunchCommandCurrent;
  const blockedByActiveBusinessRun = monitoring.blockedByActiveCurrentRun;
  const canStartBusinessExecution = monitoring.canInvokeOrRetryRun;
  const hasStaleBusinessExecutionRun = monitoring.hasStoredRunNotCurrent;
  const invocationPrimaryLabel = blockedByActiveBusinessRun
    ? "Run in progress"
    : monitoring.storedRun && (!monitoring.isRunCurrent || monitoring.view?.isTerminal)
      ? "Retry"
      : "Start business execution";
  const canPrepareExecutorIntegrationAdapter =
    isBusinessExecutionRunCurrent && Boolean(businessExecutionRun) && !isExecutorIntegrationAdapterCurrent;
  const hasStaleExecutorIntegrationAdapter =
    Boolean(executorIntegrationAdapter) && !isExecutorIntegrationAdapterCurrent;
  const canInvokeExecutorConnector =
    isExecutorIntegrationAdapterCurrent &&
    Boolean(executorIntegrationAdapter) &&
    Boolean(businessExecutionRun) &&
    !isExecutorConnectorResultCurrent;
  const hasStaleExecutorConnectorResult =
    Boolean(executorConnectorResult) && !isExecutorConnectorResultCurrent;

  const assignExecutor = (executorType: ExecutionExecutorType) => {
    if (!sessionId || !businessExecutionPackage || !canAssignExecutor) return;
    const next = assignBusinessExecutionPackage({
      pkg: businessExecutionPackage,
      executorType,
      assignedBy: "local",
    });
    recordSessionExecutionAssignment(sessionId, next);
  };

  const prepareExecutorHandoffPayload = () => {
    if (!sessionId || !canCreateHandoffPayload) return;
    if (!executionAssignment || !businessExecutionPackage) return;
    const payload = createExecutionAssignmentHandoff({
      assignment: executionAssignment,
      pkg: businessExecutionPackage,
    });
    recordSessionExecutionAssignmentHandoffPayload(sessionId, payload);
  };

  const prepareExecutorIntakeContract = () => {
    if (!sessionId || !canCreateIntakeContract) return;
    if (!executionAssignmentHandoffPayload) return;
    const contract = createExecutorIntakeContract({ handoff: executionAssignmentHandoffPayload });
    recordSessionExecutorIntakeContract(sessionId, contract);
  };

  const prepareExecutorWorkOrder = () => {
    if (!sessionId || !canCreateWorkOrder) return;
    if (!executorIntakeContract) return;
    const wo = createExecutorWorkOrder({ intake: executorIntakeContract });
    recordSessionExecutorWorkOrder(sessionId, wo);
  };

  const declareLaunchIntent = () => {
    if (!sessionId || !canDeclareLaunchIntent) return;
    if (!executorWorkOrder) return;
    const intent = declareBusinessLaunchIntent({
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      declaredBy: "local",
    });
    recordSessionBusinessLaunchIntent(sessionId, intent);
  };

  const prepareLaunchHandoffRecord = () => {
    if (!sessionId || !canRecordLaunchHandoff) return;
    if (!businessLaunchIntent || !executorWorkOrder) return;
    const record = createBusinessLaunchHandoffRecord({
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
      recordedBy: "local",
    });
    recordSessionBusinessLaunchHandoffRecord(sessionId, record);
  };

  const prepareExecutionBridge = () => {
    if (!sessionId || !canPrepareExecutionBridge) return;
    if (
      !businessLaunchHandoffRecord ||
      !businessLaunchIntent ||
      !executorWorkOrder ||
      !executorIntakeContract ||
      !executionAssignment
    ) {
      return;
    }
    const bridge = createExecutionBridgePayload({
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      intake: executorIntakeContract,
      assignment: executionAssignment,
      sessionId,
    });
    recordSessionExecutionBridgePayload(sessionId, bridge);
  };

  const prepareExecutorLaunchContract = () => {
    if (!sessionId || !canPrepareLaunchContract) return;
    if (!executionBridgePayload) return;
    const contract = createExecutorLaunchContract({
      bridge: executionBridgePayload,
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
    });
    recordSessionExecutorLaunchContract(sessionId, contract);
  };

  const markExecutionTriggerIntent = () => {
    if (!sessionId || !canDeclareExecutionTriggerIntent) return;
    if (!executorLaunchContract || !executionBridgePayload) return;
    const intent = declareExecutionTriggerIntent({
      contract: executorLaunchContract,
      bridge: executionBridgePayload,
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
      declaredBy: "local",
    });
    recordSessionExecutionTriggerIntent(sessionId, intent);
  };

  const prepareActualExecutionAdapter = () => {
    if (!sessionId || !canPrepareExecutionAdapter) return;
    if (!executionTriggerIntent || !executorLaunchContract || !executionBridgePayload) return;
    const adapter = createActualExecutionAdapterRequest({
      triggerIntent: executionTriggerIntent,
      contract: executorLaunchContract,
      bridge: executionBridgePayload,
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
    });
    recordSessionActualExecutionAdapterRequest(sessionId, adapter);
  };

  const prepareActualLaunchCommand = () => {
    if (!sessionId || !canPrepareLaunchCommand) return;
    if (!actualExecutionAdapterRequest || !executionTriggerIntent || !executorLaunchContract || !executionBridgePayload) {
      return;
    }
    const command = createActualLaunchCommand({
      adapter: actualExecutionAdapterRequest,
      triggerIntent: executionTriggerIntent,
      contract: executorLaunchContract,
      bridge: executionBridgePayload,
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
    });
    recordSessionActualLaunchCommand(sessionId, command);
  };

  const startBusinessExecution = () => {
    if (!sessionId || !canStartBusinessExecution) return;
    if (!actualLaunchCommand || !actualExecutionAdapterRequest || !executionTriggerIntent || !executorLaunchContract || !executionBridgePayload) {
      return;
    }
    const run = invokeBusinessExecution({
      command: actualLaunchCommand,
      adapter: actualExecutionAdapterRequest,
      triggerIntent: executionTriggerIntent,
      contract: executorLaunchContract,
      bridge: executionBridgePayload,
      handoffRecord: businessLaunchHandoffRecord,
      intent: businessLaunchIntent,
      readiness: executionReadiness,
      workOrder: executorWorkOrder,
      sessionId,
    });
    recordSessionBusinessExecutionRun(sessionId, run);
  };

  const applyBusinessRunControl = (kind: "running" | "completed" | "failed") => {
    if (!sessionId || !businessExecutionRun || !isBusinessExecutionRunCurrent) return;
    try {
      const next =
        kind === "running"
          ? markBusinessExecutionRunRunning(businessExecutionRun)
          : kind === "completed"
            ? markBusinessExecutionRunCompleted(businessExecutionRun)
            : markBusinessExecutionRunFailed(businessExecutionRun);
      recordSessionBusinessExecutionRun(sessionId, next);
    } catch {
      /* invalid transition — ignore */
    }
  };

  const prepareExecutorIntegrationAdapter = () => {
    if (!sessionId || !canPrepareExecutorIntegrationAdapter) return;
    if (!businessExecutionRun || !actualLaunchCommand) return;
    try {
      const adapter = createExecutorIntegrationAdapter({
        run: businessExecutionRun,
        command: actualLaunchCommand,
        adapter: actualExecutionAdapterRequest,
        triggerIntent: executionTriggerIntent,
        contract: executorLaunchContract,
        bridge: executionBridgePayload,
        handoffRecord: businessLaunchHandoffRecord,
        intent: businessLaunchIntent,
        readiness: executionReadiness,
        workOrder: executorWorkOrder,
        sessionId,
      });
      recordSessionExecutorIntegrationAdapter(sessionId, adapter);
    } catch {
      /* run not current or invalid chain */
    }
  };

  const runExecutorConnector = () => {
    if (!sessionId || !canInvokeExecutorConnector) return;
    if (!executorIntegrationAdapter || !businessExecutionRun || !actualLaunchCommand) return;
    try {
      const result = invokeExecutorConnector({
        integrationAdapter: executorIntegrationAdapter,
        run: businessExecutionRun,
        command: actualLaunchCommand,
        adapter: actualExecutionAdapterRequest,
        triggerIntent: executionTriggerIntent,
        contract: executorLaunchContract,
        bridge: executionBridgePayload,
        handoffRecord: businessLaunchHandoffRecord,
        intent: businessLaunchIntent,
        readiness: executionReadiness,
        workOrder: executorWorkOrder,
        sessionId,
      });
      recordSessionExecutorConnectorResult(sessionId, result);
    } catch {
      /* adapter not current */
    }
  };

  const openTasks = () => {
    const qs = new URLSearchParams();
    if (requirementId) qs.set("requirementId", requirementId);
    if (sessionId) qs.set("sessionId", sessionId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    router.push(`/tasks${suffix}`);
  };

  return (
    <div>
      <WorkflowPageHeader
        title="Execution"
        subtitle="Pre-execution visibility only (no launch here)"
        backHref="/workspace"
        backLabel="Back to workspace"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
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
                  onClick={() => setActiveExecutionInput({ sessionId: snapshot.sessionId, snapshotId: snapshot.snapshotId })}
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
                <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={openTasks} />
              </div>
            </div>
          )}

          {sessionId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
            </div>
          ) : null}
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch readiness</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            This is a pre-launch validation checkpoint for the active prepared input. No execution is triggered here.
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

            {launchReadiness.warnings.length > 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Warnings</div>
                {launchReadiness.warnings.map((w) => (
                  <div key={w}>- {w}</div>
                ))}
              </div>
            ) : null}

            {!launchReadiness.isLaunchReady ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={openTasks} />
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Next action</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Shows the next possible execution step based on the current active input. This is a placeholder only; nothing launches here.
          </div>

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
            <div style={{ fontSize: 13, color: "#111827" }}>
              State:{" "}
              {nextAction.canPrepareLaunchAction ? (
                <span style={{ fontWeight: 900, color: "#166534" }}>Ready for handoff</span>
              ) : (
                <span style={{ fontWeight: 900, color: "#6b7280" }}>Unavailable</span>
              )}
            </div>

            {nextAction.actionReason ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{nextAction.actionReason}</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isHandoffPrepared ? "Handoff prepared" : nextAction.actionLabel}
                variant="primary"
                disabled={!nextAction.canPrepareLaunchAction || isHandoffPrepared}
                onClick={() => {
                  if (!nextAction.canPrepareLaunchAction) return;
                  if (!pre.active) return;
                  recordSessionHandoffPrepared(pre.active.sessionId, {
                    sessionId: pre.active.sessionId,
                    snapshotId: pre.active.snapshotId,
                    preparedAtIso: new Date().toISOString(),
                    status: "prepared",
                  });
                }}
              />
              {!nextAction.canPrepareLaunchAction || snapshotStaleness.isSnapshotStale || (isHandoffPrepared && !handoffValidity.isHandoffValid) ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution request draft</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Draft is a structured request payload for a later stage. Creating a draft does not start execution.
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
                onClick={() => {
                  if (!snapshot) return;
                  if (!isHandoffPrepared) return;
                  if (!handoffValidity.isHandoffValid) return;
                  recordSessionExecutionRequestDraft(snapshot.sessionId, createExecutionRequestDraft({ snapshot }));
                }}
              />
              {!handoffValidity.isHandoffValid ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Final pre-launch checkpoint</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Approval is a local pre-execution checkpoint for the current execution draft. It does not start execution.
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
                onClick={() => {
                  if (!executionRequestDraft) return;
                  if (!handoffValidity.isHandoffValid) return;
                  const approval = approveExecutionRequestDraft({ draft: executionRequestDraft, approvedBy: "local" });
                  recordSessionExecutionRequestApproval(executionRequestDraft.sessionId, approval);
                }}
              />
              {!executionRequestDraft || !handoffValidity.isHandoffValid ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution request</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Business-side request only (not Stage1/Stage2). Not launched. Lifecycle below is computed from the current snapshot and task sets.
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
                  • artifact <span style={{ fontWeight: 900 }}>requested</span> • id{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.requestId}</span>
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
                {businessRequestNeedsAttention ? (
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
                  disabled={!canRecordBusinessRequest}
                  onClick={() => {
                    if (!snapshot) return;
                    if (!canRecordBusinessRequest) return;
                    recordSessionBusinessExecutionRequest(snapshot.sessionId, createBusinessExecutionRequest({ snapshot }));
                  }}
                />
              ) : null}
              {businessExecutionRequest && businessRequestNeedsAttention ? (
                <WorkflowActionButton
                  label="Recreate request"
                  variant="primary"
                  disabled={!canRecordBusinessRequest}
                  onClick={() => {
                    if (!snapshot) return;
                    if (!canRecordBusinessRequest) return;
                    recordSessionBusinessExecutionRequest(snapshot.sessionId, createBusinessExecutionRequest({ snapshot }));
                  }}
                />
              ) : null}
              {!canRecordBusinessRequest || businessRequestNeedsAttention ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution approval</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Finalizes the current business execution request for business-side tracking only. Does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to manage approval.</div>
            ) : !businessExecutionRequest || !bizReqValidity ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution request yet.</div>
            ) : !businessRequestValid ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Approval unavailable while the request is{" "}
                <span style={{ fontWeight: 900, color: "#b45309" }}>
                  {bizReqValidity.status === "stale" ? "stale" : "invalid"}
                </span>
                . Recreate or fix the request in /tasks, then return here.
              </div>
            ) : null}

            {hasOrphanBusinessApproval ? (
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
            ) : sessionId && businessExecutionRequest && businessRequestValid ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Not finalized yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isBusinessExecutionApproved ? "Approved" : "Approve execution request"}
                variant="primary"
                disabled={!sessionId || !canApproveBusinessExecution}
                onClick={() => {
                  if (!sessionId || !businessExecutionRequest || !businessRequestValid) return;
                  const approval = approveBusinessExecutionRequest({ request: businessExecutionRequest, approvedBy: "local" });
                  recordSessionBusinessExecutionApproval(sessionId, approval);
                }}
              />
              {sessionId && (!businessExecutionRequest || !businessRequestValid) ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution package</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Bundles the approved business execution request into a stable work package for later handoff. Does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to manage the execution package.</div>
            ) : !isBusinessExecutionApproved ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Packaging unavailable until the business execution request is <span style={{ fontWeight: 900 }}>approved</span> for the current snapshot.
              </div>
            ) : null}

            {hasNonCurrentPackage ? (
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
                  request <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.requestId}</span> • approval{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.approvalId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4, lineHeight: 1.5 }}>
                  session <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.sessionId}</span> • snapshot{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.snapshotId}</span> • candidates{" "}
                  <span style={{ fontWeight: 900 }}>{businessExecutionPackage.candidateTaskIds.length}</span> • created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.createdAtIso}</span>
                </div>
              </div>
            ) : sessionId && isBusinessExecutionApproved ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No package prepared yet for this approved request.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isBusinessExecutionPackaged ? "Packaged" : "Prepare execution package"}
                variant="primary"
                disabled={!sessionId || !canCreateBusinessPackage}
                onClick={() => {
                  if (!sessionId || !canCreateBusinessPackage) return;
                  if (!businessExecutionRequest || !businessExecutionApproval) return;
                  const pkg = createBusinessExecutionPackage({
                    request: businessExecutionRequest,
                    approval: businessExecutionApproval,
                  });
                  recordSessionBusinessExecutionPackage(sessionId, pkg);
                }}
              />
              {sessionId && !isBusinessExecutionApproved ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution assignment</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Records which executor role should handle the current package. Intent only — does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to assign an executor.</div>
            ) : !isBusinessExecutionPackaged ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Assignment unavailable until an <span style={{ fontWeight: 900 }}>execution package</span> exists for the current approved request.
              </div>
            ) : null}

            {hasNonCurrentAssignment ? (
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
                  package <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.packageId}</span> • executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionAssignment.executorType]}</span> (
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.executorType}</span>)
                </div>
                <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, lineHeight: 1.5 }}>
                  Assigned <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.assignedAtIso}</span> • request{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.requestId}</span>
                </div>
              </div>
            ) : sessionId && isBusinessExecutionPackaged ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No executor assigned yet for this package.</div>
            ) : null}

            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginTop: 4 }}>Assign executor</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EXECUTION_EXECUTOR_TYPES.map((t) => (
                <WorkflowActionButton
                  key={t}
                  label={EXECUTOR_TYPE_LABELS[t]}
                  variant={isExecutionPackageAssigned && executionAssignment?.executorType === t ? "primary" : undefined}
                  disabled={!sessionId || !canAssignExecutor}
                  onClick={() => assignExecutor(t)}
                />
              ))}
            </div>
            {sessionId && !isBusinessExecutionPackaged ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor handoff payload</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Stable bundle for a future executor consumer from the current assignment. Does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a handoff payload.</div>
            ) : !isExecutionPackageAssigned ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Handoff unavailable until the current package has a valid <span style={{ fontWeight: 900 }}>executor assignment</span>.
              </div>
            ) : null}

            {hasNonCurrentHandoffPayload ? (
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
                <div style={{ fontSize: 12, color: "#c2410c", marginTop: 4, lineHeight: 1.5 }}>
                  assignment <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignmentHandoffPayload.assignmentId}</span> • executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionAssignmentHandoffPayload.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#c2410c", marginTop: 4, lineHeight: 1.5 }}>
                  package <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignmentHandoffPayload.packageId}</span> • created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignmentHandoffPayload.createdAtIso}</span> • candidates{" "}
                  <span style={{ fontWeight: 900 }}>{executionAssignmentHandoffPayload.candidateTaskIds.length}</span>
                </div>
              </div>
            ) : sessionId && isExecutionPackageAssigned ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No handoff payload yet for this assignment.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutionAssignmentHandoffCurrent ? "Handoff prepared" : "Prepare executor handoff"}
                variant="primary"
                disabled={!sessionId || !canCreateHandoffPayload}
                onClick={prepareExecutorHandoffPayload}
              />
              {sessionId && !isExecutionPackageAssigned ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor intake contract</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Executor-facing structured input from the current handoff. Does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare an intake contract.</div>
            ) : !isExecutionAssignmentHandoffCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Intake unavailable until a <span style={{ fontWeight: 900 }}>current handoff payload</span> exists for this assignment.
              </div>
            ) : null}

            {hasNonCurrentIntakeContract ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored intake contract does not match the current handoff. Prepare again to replace it (latest only).
              </div>
            ) : null}

            {isExecutorIntakeContractCurrent && executorIntakeContract ? (
              <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: 10, background: "#ecfdf5" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#065f46" }}>Intake prepared</div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 6, lineHeight: 1.5 }}>
                  Status <span style={{ fontWeight: 900 }}>intake_ready</span> • intake{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.intakeId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 4, lineHeight: 1.5 }}>
                  executor <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorIntakeContract.executorType]}</span> • handoff{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.handoffId}</span> • package{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.packageId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 4, lineHeight: 1.45 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.createdAtIso}</span> •{" "}
                  <span style={{ fontStyle: "italic" }}>{executorIntakePreviewLine(executorIntakeContract)}</span>
                </div>
              </div>
            ) : sessionId && isExecutionAssignmentHandoffCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No intake contract yet for this handoff.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutorIntakeContractCurrent ? "Intake prepared" : "Prepare executor input"}
                variant="primary"
                disabled={!sessionId || !canCreateIntakeContract}
                onClick={prepareExecutorIntakeContract}
              />
              {sessionId && !isExecutionAssignmentHandoffCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor work order</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Actionable instructions for the executor from the current intake. Does not start Stage1/Stage2 or any real launch.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a work order.</div>
            ) : !isExecutorIntakeContractCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Work order unavailable until a <span style={{ fontWeight: 900 }}>current intake contract</span> exists.
              </div>
            ) : null}

            {hasNonCurrentWorkOrder ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored work order does not match the current intake. Prepare again to replace it (latest only).
              </div>
            ) : null}

            {isExecutorWorkOrderCurrent && executorWorkOrder ? (
              <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, padding: 10, background: "#eef2ff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#3730a3" }}>Work order prepared</div>
                <div style={{ fontSize: 12, color: "#4338ca", marginTop: 6, lineHeight: 1.5 }}>
                  Status <span style={{ fontWeight: 900 }}>prepared</span> • work order{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorWorkOrder.workOrderId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#4338ca", marginTop: 4, lineHeight: 1.5 }}>
                  executor <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorWorkOrder.executorType]}</span> • intake{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorWorkOrder.intakeId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#4338ca", marginTop: 4, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 900 }}>{executorWorkOrder.title}</span> • created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorWorkOrder.createdAtIso}</span>
                </div>
                <div style={{ fontSize: 11, color: "#6366f1", marginTop: 6, lineHeight: 1.45 }}>
                  Objective: {truncateWorkOrderPreview(executorWorkOrder.objective, 96)}
                </div>
                <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4, lineHeight: 1.45 }}>
                  Success: {truncateWorkOrderPreview(executorWorkOrder.successCriteria, 96)}
                </div>
              </div>
            ) : sessionId && isExecutorIntakeContractCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No work order yet for this intake.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutorWorkOrderCurrent ? "Work order prepared" : "Prepare executor work order"}
                variant="primary"
                disabled={!sessionId || !canCreateWorkOrder}
                onClick={prepareExecutorWorkOrder}
              />
              {sessionId && !isExecutorIntakeContractCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution readiness</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Derived check only — does not start execution or Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: "#111827" }}>
              Status:{" "}
              {executionReadiness.status === "ready" ? (
                <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
              ) : (
                <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
              )}
            </div>
            {executionReadiness.status === "not_ready" && executionReadiness.reasons.length > 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                {executionReadiness.reasons.slice(0, EXECUTION_READINESS_UI_REASONS_MAX).map((r, i) => (
                  <div key={`${i}-${r}`}>- {r}</div>
                ))}
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch intent</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Business-side declaration only — does not start execution or Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to declare launch intent.</div>
            ) : executionReadiness.status !== "ready" ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Launch intent unavailable until <span style={{ fontWeight: 900 }}>execution readiness</span> is ready.
              </div>
            ) : null}

            {hasNonCurrentLaunchIntent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored launch intent does not match the current ready work order. Declare again to replace it (latest only).
              </div>
            ) : null}

            {isBusinessLaunchIntentCurrent && businessLaunchIntent ? (
              <div style={{ border: "1px solid #fce7f3", borderRadius: 10, padding: 10, background: "#fdf2f8" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#9d174d" }}>Launch intent declared</div>
                <div style={{ fontSize: 12, color: "#be185d", marginTop: 6, lineHeight: 1.5 }}>
                  Status <span style={{ fontWeight: 900 }}>declared</span> • intent{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchIntent.intentId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#be185d", marginTop: 4, lineHeight: 1.5 }}>
                  work order <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchIntent.workOrderId}</span> • session{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchIntent.sessionId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#be185d", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchIntent.createdAtIso}</span>
                </div>
              </div>
            ) : sessionId && executionReadiness.status === "ready" ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No launch intent declared yet for this ready state.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isBusinessLaunchIntentCurrent ? "Intent declared" : "Declare launch intent"}
                variant="primary"
                disabled={!sessionId || !canDeclareLaunchIntent}
                onClick={declareLaunchIntent}
              />
              {sessionId && executionReadiness.status !== "ready" ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch handoff</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Records a handoff-ready business artifact from the <span style={{ fontWeight: 900 }}>current launch intent</span>. Not launched — no Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a launch handoff record.</div>
            ) : !isBusinessLaunchIntentCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Handoff record unavailable until a <span style={{ fontWeight: 900 }}>current launch intent</span> exists for this session.
              </div>
            ) : null}

            {hasStaleLaunchHandoffRecord ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored handoff record no longer matches the current launch intent or readiness. Use “Prepare launch handoff record” again (latest only).
              </div>
            ) : null}

            {isBusinessLaunchHandoffRecordCurrent && businessLaunchHandoffRecord ? (
              <div style={{ border: "1px solid #ccfbf1", borderRadius: 10, padding: 10, background: "#f0fdfa" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f766e" }}>Handoff recorded</div>
                <div style={{ fontSize: 12, color: "#115e59", marginTop: 6, lineHeight: 1.5 }}>
                  Ready for execution handoff · status <span style={{ fontWeight: 900 }}>recorded</span> ·{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchHandoffRecord.handoffRecordId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#115e59", marginTop: 4, lineHeight: 1.5 }}>
                  intent <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchHandoffRecord.intentId}</span> · work order{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchHandoffRecord.workOrderId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#115e59", marginTop: 4, lineHeight: 1.5 }}>
                  session <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchHandoffRecord.sessionId}</span> · created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessLaunchHandoffRecord.createdAtIso}</span>
                </div>
              </div>
            ) : sessionId && isBusinessLaunchIntentCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No handoff record on file for this current intent yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isBusinessLaunchHandoffRecordCurrent ? "Handoff recorded" : "Prepare launch handoff record"}
                variant="primary"
                disabled={!sessionId || !canRecordLaunchHandoff}
                onClick={prepareLaunchHandoffRecord}
              />
              {sessionId && !isBusinessLaunchIntentCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution bridge</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Builds a structured payload for a future execution consumer from the <span style={{ fontWeight: 900 }}>current launch handoff record</span>. Not
            launched — no Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare an execution bridge.</div>
            ) : !isBusinessLaunchHandoffRecordCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Bridge unavailable until a <span style={{ fontWeight: 900 }}>current launch handoff record</span> exists.
              </div>
            ) : null}

            {hasStaleExecutionBridgePayload ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored bridge no longer matches the current handoff record or upstream state. Use “Prepare execution bridge” again (latest only).
              </div>
            ) : null}

            {isExecutionBridgePayloadCurrent && executionBridgePayload ? (
              <div style={{ border: "1px solid #e9d5ff", borderRadius: 10, padding: 10, background: "#faf5ff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#6b21a8" }}>Bridge ready</div>
                <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 6, lineHeight: 1.5 }}>
                  Status <span style={{ fontWeight: 900 }}>bridge_ready</span> · bridge{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionBridgePayload.bridgeId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, lineHeight: 1.5 }}>
                  executor <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionBridgePayload.executorType]}</span> · work order{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionBridgePayload.workOrderId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionBridgePayload.createdAtIso}</span>
                </div>
              </div>
            ) : sessionId && isBusinessLaunchHandoffRecordCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No execution bridge on file for this current handoff yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutionBridgePayloadCurrent ? "Bridge ready" : "Prepare execution bridge"}
                variant="primary"
                disabled={!sessionId || !canPrepareExecutionBridge}
                onClick={prepareExecutionBridge}
              />
              {sessionId && !isBusinessLaunchHandoffRecordCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor launch contract</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Final structured executor input from the <span style={{ fontWeight: 900 }}>current execution bridge</span>. Not launched — no Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a launch contract.</div>
            ) : !isExecutionBridgePayloadCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Contract unavailable until a <span style={{ fontWeight: 900 }}>current bridge</span> exists.
              </div>
            ) : null}

            {hasStaleExecutorLaunchContract ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored launch contract no longer matches the current bridge. Use “Prepare launch contract” again (latest only).
              </div>
            ) : null}

            {isExecutorLaunchContractCurrent && executorLaunchContract ? (
              <div style={{ border: "1px solid #cffafe", borderRadius: 10, padding: 10, background: "#ecfeff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0e7490" }}>Launch contract ready</div>
                <div style={{ fontSize: 12, color: "#155e75", marginTop: 6, lineHeight: 1.5 }}>
                  Final executor input · status <span style={{ fontWeight: 900 }}>launch_contract_ready</span> · contract{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorLaunchContract.launchContractId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#155e75", marginTop: 4, lineHeight: 1.5 }}>
                  bridge <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorLaunchContract.bridgeId}</span> · executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorLaunchContract.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#155e75", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorLaunchContract.createdAtIso}</span>
                </div>
                <div style={{ fontSize: 11, color: "#0e7490", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  Context: {executorLaunchContractContextSummary(executorLaunchContract)}
                </div>
                <div style={{ fontSize: 11, color: "#0e7490", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                  Launch hints: {executorLaunchHintsPreview(executorLaunchContract.launchHints)}
                  …
                </div>
              </div>
            ) : sessionId && isExecutionBridgePayloadCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No launch contract on file for this current bridge yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutorLaunchContractCurrent ? "Contract ready" : "Prepare launch contract"}
                variant="primary"
                disabled={!sessionId || !canPrepareLaunchContract}
                onClick={prepareExecutorLaunchContract}
              />
              {sessionId && !isExecutionBridgePayloadCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution trigger intent</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Marks the <span style={{ fontWeight: 900 }}>current launch contract</span> as intended for a future trigger only. Not launched — no Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to declare trigger intent.</div>
            ) : !isExecutorLaunchContractCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Trigger intent unavailable until a <span style={{ fontWeight: 900 }}>current launch contract</span> exists.
              </div>
            ) : null}

            {hasStaleExecutionTriggerIntent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored trigger intent no longer matches the current launch contract. Declare again (latest only).
              </div>
            ) : null}

            {isExecutionTriggerIntentCurrent && executionTriggerIntent ? (
              <div style={{ border: "1px solid #ffedd5", borderRadius: 10, padding: 10, background: "#fff7ed" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#c2410c" }}>Trigger intent declared</div>
                <div style={{ fontSize: 12, color: "#9a3412", marginTop: 6, lineHeight: 1.5 }}>
                  Ready to trigger later · status <span style={{ fontWeight: 900 }}>declared</span> · intent{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionTriggerIntent.triggerIntentId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9a3412", marginTop: 4, lineHeight: 1.5 }}>
                  contract <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionTriggerIntent.launchContractId}</span> · executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionTriggerIntent.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9a3412", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionTriggerIntent.createdAtIso}</span>
                </div>
              </div>
            ) : sessionId && isExecutorLaunchContractCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No trigger intent declared for this current contract yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isExecutionTriggerIntentCurrent ? "Trigger intent declared" : "Declare trigger intent"}
                variant="primary"
                disabled={!sessionId || !canDeclareExecutionTriggerIntent}
                onClick={markExecutionTriggerIntent}
              />
              {sessionId && !isExecutorLaunchContractCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Actual execution adapter</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Prepares a structured request for a future <span style={{ fontWeight: 900 }}>actual execution</span> consumer from the current trigger intent. Not
            launched — no Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare an execution adapter.</div>
            ) : !isExecutionTriggerIntentCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Adapter unavailable until a <span style={{ fontWeight: 900 }}>current trigger intent</span> exists.
              </div>
            ) : null}

            {hasStaleActualExecutionAdapterRequest ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored adapter no longer matches the current trigger intent or upstream state. Use “Prepare execution adapter” again (latest only).
              </div>
            ) : null}

            {isActualExecutionAdapterRequestCurrent && actualExecutionAdapterRequest ? (
              <div style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: 10, background: "#eff6ff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8" }}>Adapter ready</div>
                <div style={{ fontSize: 12, color: "#1e40af", marginTop: 6, lineHeight: 1.5 }}>
                  Ready for actual execution handoff · status <span style={{ fontWeight: 900 }}>adapter_ready</span> · request{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualExecutionAdapterRequest.adapterRequestId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4, lineHeight: 1.5 }}>
                  trigger intent{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualExecutionAdapterRequest.triggerIntentId}</span> · executor{" "}
                  <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[actualExecutionAdapterRequest.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualExecutionAdapterRequest.createdAtIso}</span>
                </div>
                <div style={{ fontSize: 11, color: "#2563eb", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  Payload: {actualExecutionAdapterPayloadSummary(actualExecutionAdapterRequest)}
                </div>
                <div style={{ fontSize: 11, color: "#2563eb", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                  Hint: {actualExecutionAdapterExecutorHintPreview(actualExecutionAdapterRequest)}
                </div>
              </div>
            ) : sessionId && isExecutionTriggerIntentCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No adapter on file for this current trigger intent yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isActualExecutionAdapterRequestCurrent ? "Adapter ready" : "Prepare execution adapter"}
                variant="primary"
                disabled={!sessionId || !canPrepareExecutionAdapter}
                onClick={prepareActualExecutionAdapter}
              />
              {sessionId && !isExecutionTriggerIntentCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Actual launch command</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Final command artifact from the <span style={{ fontWeight: 900 }}>current execution adapter</span> for a future launch invocation only. Not launched — no
            Stage1/Stage2.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare a launch command.</div>
            ) : !isActualExecutionAdapterRequestCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Launch command unavailable until a <span style={{ fontWeight: 900 }}>current adapter request</span> exists.
              </div>
            ) : null}

            {hasStaleActualLaunchCommand ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored launch command no longer matches the current adapter. Use “Prepare launch command” again (latest only).
              </div>
            ) : null}

            {isActualLaunchCommandCurrent && actualLaunchCommand ? (
              <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: 10, background: "#ecfdf5" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#047857" }}>Command ready</div>
                <div style={{ fontSize: 12, color: "#065f46", marginTop: 6, lineHeight: 1.5 }}>
                  Ready for launch invocation · status <span style={{ fontWeight: 900 }}>command_ready</span> · command{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualLaunchCommand.launchCommandId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#065f46", marginTop: 4, lineHeight: 1.5 }}>
                  adapter{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualLaunchCommand.adapterRequestId}</span> · trigger intent{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualLaunchCommand.triggerIntentId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#065f46", marginTop: 4, lineHeight: 1.5 }}>
                  executor <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[actualLaunchCommand.executorType]}</span>
                </div>
                <div style={{ fontSize: 12, color: "#065f46", marginTop: 4, lineHeight: 1.5 }}>
                  created <span style={{ fontFamily: "ui-monospace, monospace" }}>{actualLaunchCommand.createdAtIso}</span>
                </div>
                <div style={{ fontSize: 11, color: "#059669", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                  Command: {actualLaunchCommandPayloadSummary(actualLaunchCommand)}
                </div>
                <div style={{ fontSize: 11, color: "#059669", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                  Hint: {actualLaunchCommandExecutorHintPreview(actualLaunchCommand)}
                </div>
              </div>
            ) : sessionId && isActualExecutionAdapterRequestCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No launch command on file for this current adapter yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isActualLaunchCommandCurrent ? "Command ready" : "Prepare launch command"}
                variant="primary"
                disabled={!sessionId || !canPrepareLaunchCommand}
                onClick={prepareActualLaunchCommand}
              />
              {sessionId && !isActualExecutionAdapterRequestCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution run</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Creates the latest tracked business-side run from the <span style={{ fontWeight: 900 }}>current launch command</span> only. In-memory · not Stage1/Stage2 · not
            environment test flow · not Git.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {!sessionId ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to start a business execution run.</div>
            ) : !isActualLaunchCommandCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Execution unavailable until a <span style={{ fontWeight: 900 }}>current launch command</span> exists.
              </div>
            ) : null}

            {hasStaleBusinessExecutionRun ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A stored run no longer matches the current launch command. Use <span style={{ fontWeight: 900 }}>Retry</span> when the command is current to replace it
                (latest only).
              </div>
            ) : null}

            {sessionId && isActualLaunchCommandCurrent && !isBusinessExecutionRunCurrent ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution run for this current command yet.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <WorkflowActionButton
                label={invocationPrimaryLabel}
                variant="primary"
                disabled={!sessionId || !canStartBusinessExecution}
                onClick={startBusinessExecution}
              />
              {sessionId && !isActualLaunchCommandCurrent ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

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
                      Launch command is current — you can <span style={{ fontWeight: 900 }}>Retry</span> above to start a fresh run.
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
                  onClick={() => applyBusinessRunControl("running")}
                />
                <WorkflowActionButton
                  label="Mark completed"
                  variant="secondary"
                  disabled={!sessionId || !monitoring.canMarkCompleted}
                  onClick={() => applyBusinessRunControl("completed")}
                />
                <WorkflowActionButton
                  label="Mark failed"
                  variant="secondary"
                  disabled={!sessionId || !monitoring.canMarkFailed}
                  onClick={() => applyBusinessRunControl("failed")}
                />
                <WorkflowActionButton
                  label="Retry"
                  variant="secondary"
                  disabled={!sessionId || !monitoring.canInvokeOrRetryRun || monitoring.blockedByActiveCurrentRun}
                  onClick={startBusinessExecution}
                />
              </div>
            </div>
          )}
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor integration</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
            Turn the <span style={{ fontWeight: 900 }}>current</span> business execution run into a structured integration envelope. Artifact only ·{" "}
            <span style={{ fontWeight: 900 }}>not connected yet</span> · no external executor calls · not Stage1/Stage2.
          </div>
          {!sessionId ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session to prepare an integration adapter.</div>
          ) : !isBusinessExecutionRunCurrent || !businessExecutionRun ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Integration unavailable until a <span style={{ fontWeight: 900 }}>current</span> business execution run exists.
            </div>
          ) : null}
          {hasStaleExecutorIntegrationAdapter ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
              A stored adapter no longer matches the current run or launch command. Prepare again after the run is current.
            </div>
          ) : null}
          {isExecutorIntegrationAdapterCurrent && executorIntegrationAdapter ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background: "#f9fafb",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Ready for executor connection</div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                Status <span style={{ fontWeight: 900 }}>integration ready</span> · adapter{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntegrationAdapter.integrationAdapterId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                run <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntegrationAdapter.runId}</span> · executor{" "}
                <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executorIntegrationAdapter.executorType]}</span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>
                created <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntegrationAdapter.createdAtIso}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 1.45, fontStyle: "italic" }}>
                {executorIntegrationAdapterPayloadSummary(executorIntegrationAdapter.adapterPayload)}
              </div>
              <div style={{ fontSize: 11, color: "#059669", marginTop: 4, lineHeight: 1.45, fontStyle: "italic" }}>
                Hint: {executorIntegrationAdapterExecutorHint(executorIntegrationAdapter.adapterPayload)}
              </div>
            </div>
          ) : sessionId && isBusinessExecutionRunCurrent && businessExecutionRun ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>
              No integration adapter for this current run yet.
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowActionButton
              label="Prepare integration adapter"
              variant="primary"
              disabled={!sessionId || !canPrepareExecutorIntegrationAdapter}
              onClick={prepareExecutorIntegrationAdapter}
            />
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Executor connector</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
            Passes the <span style={{ fontWeight: 900 }}>current</span> integration adapter through the connector interface (stub/mock). Not Stage1/Stage2 · not environment procedure test · no Git/PR/merge.
          </div>
          {!sessionId ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Select a session for connector invocation.</div>
          ) : !isExecutorIntegrationAdapterCurrent || !executorIntegrationAdapter ? (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Connector unavailable until a <span style={{ fontWeight: 900 }}>current</span> integration adapter exists.
            </div>
          ) : null}
          {hasStaleExecutorConnectorResult ? (
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
                adapter{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorConnectorResult.integrationAdapterId}</span> · executor{" "}
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
              disabled={!sessionId || !canInvokeExecutorConnector}
              onClick={runExecutorConnector}
            />
          </div>
        </WorkflowCard>
      </div>
    </div>
  );
}

