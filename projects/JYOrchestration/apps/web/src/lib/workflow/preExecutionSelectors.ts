import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import {
  getActiveExecutionInput,
  isActiveExecutionSnapshot,
  isHandoffPreparedForActive,
  resolveSessionExecutionCandidates,
  resolveSessionExecutionLaunchSnapshot,
  isExecutionDraftApproved,
  resolveSessionExecutionRequestApproval,
  resolveSessionExecutionRequestDraft,
  resolveSessionHandoffPrepared,
  sessionHasExecutionRequestDraft,
  resolveSessionTaskReadiness,
} from "@/lib/workflow/preExecutionStateStore";
import { validateActiveExecutionInput, type LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";
import {
  evaluateHandoffValidity,
  evaluateSnapshotStaleness,
  type HandoffValidityResult,
  type SnapshotStalenessResult,
} from "@/lib/workflow/preExecutionStaleness";
import { resolveSessionConfirmedTasks } from "@/lib/workflow/collaborationSessionContentStore";
import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import { getExecutorWorkOrderStateForSession } from "@/lib/workflow/executorWorkOrderGate";
import {
  evaluateExecutionReadiness,
  noSessionExecutionReadiness,
  type ExecutionReadiness,
} from "@/lib/workflow/executionReadiness";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import { isBusinessLaunchIntentCurrent as computeBusinessLaunchIntentCurrent } from "@/lib/workflow/businessLaunchIntent";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import { isBusinessLaunchHandoffRecordCurrent as computeBusinessLaunchHandoffRecordCurrent } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import { isExecutionBridgePayloadCurrent as computeExecutionBridgePayloadCurrent } from "@/lib/workflow/executionBridgePayload";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import { isExecutorLaunchContractCurrent as computeExecutorLaunchContractCurrent } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import { isExecutionTriggerIntentCurrent as computeExecutionTriggerIntentCurrent } from "@/lib/workflow/executionTriggerIntent";
import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import { isActualExecutionAdapterRequestCurrent as computeActualExecutionAdapterRequestCurrent } from "@/lib/workflow/actualExecutionAdapter";
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import { isActualLaunchCommandCurrent as computeActualLaunchCommandCurrent } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import { isBusinessExecutionRunCurrent as computeBusinessExecutionRunCurrent } from "@/lib/workflow/businessExecutionRun";
import type { ExecutorIntegrationAdapter } from "@/lib/workflow/executorIntegrationAdapter";
import { isExecutorIntegrationAdapterCurrent as computeExecutorIntegrationAdapterCurrent } from "@/lib/workflow/executorIntegrationAdapter";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import { isExecutorConnectorResultCurrent as computeExecutorConnectorResultCurrent } from "@/lib/workflow/executorConnector";
import {
  isBusinessExecutionRequestForSnapshot,
  sessionHasBusinessExecutionRequest,
  resolveSessionActualExecutionAdapterRequest,
  resolveSessionActualLaunchCommand,
  resolveSessionBusinessExecutionRun,
  resolveSessionExecutorIntegrationAdapter,
  resolveSessionExecutorConnectorResult,
  resolveSessionBusinessLaunchHandoffRecord,
  resolveSessionBusinessLaunchIntent,
  resolveSessionExecutionBridgePayload,
  resolveSessionExecutionTriggerIntent,
  resolveSessionExecutorLaunchContract,
  type ExecutionRequestValidityResult,
} from "@/lib/workflow/businessExecutionRequestStore";

export type PreExecutionSessionSelector = {
  readinessMap: Record<string, "not_ready" | "ready">;
  candidateTasks: ReturnType<typeof resolveSessionExecutionCandidates>;
  snapshot: ExecutionLaunchSnapshot | undefined;
  active: ReturnType<typeof getActiveExecutionInput>;
  isSnapshotActive: boolean;
  launchReadiness: LaunchReadinessResult;
  handoffPrepared: ReturnType<typeof resolveSessionHandoffPrepared>;
  isHandoffPreparedActive: boolean;
  snapshotStaleness: SnapshotStalenessResult;
  handoffValidity: HandoffValidityResult;
  executionRequestDraft: ReturnType<typeof resolveSessionExecutionRequestDraft>;
  hasExecutionRequestDraft: boolean;
  executionRequestApproval: ReturnType<typeof resolveSessionExecutionRequestApproval>;
  isExecutionDraftApproved: boolean;
  businessExecutionRequest: BusinessExecutionRequest | undefined;
  hasBusinessExecutionRequest: boolean;
  isBusinessExecutionRequestForCurrentSnapshot: boolean;
  businessExecutionRequestValidity: ExecutionRequestValidityResult | null;
  businessExecutionApproval: BusinessExecutionApproval | undefined;
  isBusinessExecutionApproved: boolean;
  businessExecutionPackage: BusinessExecutionPackage | undefined;
  isBusinessExecutionPackaged: boolean;
  executionAssignment: ExecutionAssignment | undefined;
  isExecutionPackageAssigned: boolean;
  executionAssignmentHandoffPayload: ExecutionAssignmentHandoffPayload | undefined;
  isExecutionAssignmentHandoffCurrent: boolean;
  executorIntakeContract: ExecutorIntakeContract | undefined;
  isExecutorIntakeContractCurrent: boolean;
  executorWorkOrder: ExecutorWorkOrder | undefined;
  isExecutorWorkOrderCurrent: boolean;
  executionReadiness: ExecutionReadiness;
  businessLaunchIntent: BusinessLaunchIntent | undefined;
  isBusinessLaunchIntentCurrent: boolean;
  businessLaunchHandoffRecord: BusinessLaunchHandoffRecord | undefined;
  isBusinessLaunchHandoffRecordCurrent: boolean;
  executionBridgePayload: ExecutionBridgePayload | undefined;
  isExecutionBridgePayloadCurrent: boolean;
  executorLaunchContract: ExecutorLaunchContract | undefined;
  isExecutorLaunchContractCurrent: boolean;
  executionTriggerIntent: ExecutionTriggerIntent | undefined;
  isExecutionTriggerIntentCurrent: boolean;
  actualExecutionAdapterRequest: ActualExecutionAdapterRequest | undefined;
  isActualExecutionAdapterRequestCurrent: boolean;
  actualLaunchCommand: ActualLaunchCommand | undefined;
  isActualLaunchCommandCurrent: boolean;
  businessExecutionRun: BusinessExecutionRun | undefined;
  isBusinessExecutionRunCurrent: boolean;
  executorIntegrationAdapter: ExecutorIntegrationAdapter | undefined;
  isExecutorIntegrationAdapterCurrent: boolean;
  executorConnectorResult: ExecutorConnectorResult | undefined;
  isExecutorConnectorResultCurrent: boolean;
};

export function getPreExecutionStateForSession(sessionId: string | null | undefined): PreExecutionSessionSelector {
  const readinessMap = resolveSessionTaskReadiness(sessionId);
  const candidateTasks = resolveSessionExecutionCandidates(sessionId);
  const snapshot = resolveSessionExecutionLaunchSnapshot(sessionId);
  const active = getActiveExecutionInput();
  const isSnapshotActive = isActiveExecutionSnapshot(sessionId, snapshot?.snapshotId);
  const launchReadiness = validateActiveExecutionInput({ active });
  const handoffPrepared = resolveSessionHandoffPrepared(sessionId);
  const isHandoffPreparedActive = isHandoffPreparedForActive(active, handoffPrepared);
  const confirmed = resolveSessionConfirmedTasks(sessionId) ?? [];
  const snapshotStaleness = evaluateSnapshotStaleness({
    snapshot,
    currentConfirmedTaskIds: confirmed.map((t) => t.id),
    currentCandidateTaskIds: candidateTasks.map((t) => t.id),
    active,
  });
  const handoffValidity = evaluateHandoffValidity({
    launchReadiness,
    staleness: snapshotStaleness,
    active,
    handoffPrepared,
  });
  const executionRequestDraft = resolveSessionExecutionRequestDraft(sessionId);
  const hasExecutionRequestDraft = sessionHasExecutionRequestDraft(sessionId);
  const executionRequestApproval = resolveSessionExecutionRequestApproval(sessionId);
  const isApproved = isExecutionDraftApproved(executionRequestDraft, executionRequestApproval);
  const hasBusinessExecutionRequest = sessionHasBusinessExecutionRequest(sessionId);
  const workOrderGate = getExecutorWorkOrderStateForSession(sessionId, {
    snapshot,
    currentCandidateTaskIds: candidateTasks.map((t) => t.id),
    currentConfirmedTaskIds: confirmed.map((t) => t.id),
  });
  const businessExecutionRequest = workOrderGate.request;
  const isBusinessExecutionRequestForCurrentSnapshot = isBusinessExecutionRequestForSnapshot(businessExecutionRequest, snapshot?.snapshotId);
  const businessExecutionRequestValidity = workOrderGate.validity;
  const businessExecutionApproval = workOrderGate.approval;
  const isBusinessExecutionApproved = workOrderGate.isEffectivelyApproved;
  const businessExecutionPackage = workOrderGate.pkg;
  const isBusinessExecutionPackaged = workOrderGate.isEffectivelyPackaged;
  const executionAssignment = workOrderGate.assignment;
  const isExecutionPackageAssigned = workOrderGate.isEffectivelyAssigned;
  const executionAssignmentHandoffPayload = workOrderGate.handoffPayload;
  const isExecutionAssignmentHandoffCurrent = workOrderGate.isEffectivelyHandoffReady;
  const executorIntakeContract = workOrderGate.intakeContract;
  const isExecutorIntakeContractCurrent = workOrderGate.isEffectivelyIntakeReady;
  const executorWorkOrder = workOrderGate.workOrder;
  const isExecutorWorkOrderCurrent = workOrderGate.isEffectivelyWorkOrderReady;
  const executionReadiness = sessionId
    ? evaluateExecutionReadiness({
        sessionId,
        requirementId: workOrderGate.request?.requirementId ?? workOrderGate.workOrder?.requirementId ?? null,
        workOrderId: workOrderGate.workOrder?.workOrderId ?? "",
        hasWorkOrder: Boolean(workOrderGate.workOrder),
        isWorkOrderCurrent: workOrderGate.isEffectivelyWorkOrderReady,
        hasBusinessRequest: Boolean(workOrderGate.request),
        requestValidityStatus: workOrderGate.validity?.status ?? null,
        isPackaged: workOrderGate.isEffectivelyPackaged,
        isAssigned: workOrderGate.isEffectivelyAssigned,
        isHandoffCurrent: workOrderGate.isEffectivelyHandoffReady,
        isIntakeCurrent: workOrderGate.isEffectivelyIntakeReady,
      })
    : noSessionExecutionReadiness();
  const businessLaunchIntent = resolveSessionBusinessLaunchIntent(sessionId);
  const isBusinessLaunchIntentCurrent = computeBusinessLaunchIntentCurrent({
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: executorWorkOrder,
    sessionId,
  });
  const businessLaunchHandoffRecord = resolveSessionBusinessLaunchHandoffRecord(sessionId);
  const isBusinessLaunchHandoffRecordCurrent = computeBusinessLaunchHandoffRecordCurrent({
    record: businessLaunchHandoffRecord,
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: executorWorkOrder,
    sessionId,
  });
  const executionBridgePayload = resolveSessionExecutionBridgePayload(sessionId);
  const isExecutionBridgePayloadCurrent = computeExecutionBridgePayloadCurrent({
    bridge: executionBridgePayload,
    handoffRecord: businessLaunchHandoffRecord,
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: executorWorkOrder,
    sessionId,
  });
  const executorLaunchContract = resolveSessionExecutorLaunchContract(sessionId);
  const isExecutorLaunchContractCurrent = computeExecutorLaunchContractCurrent({
    contract: executorLaunchContract,
    bridge: executionBridgePayload,
    handoffRecord: businessLaunchHandoffRecord,
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: executorWorkOrder,
    sessionId,
  });
  const executionTriggerIntent = resolveSessionExecutionTriggerIntent(sessionId);
  const isExecutionTriggerIntentCurrent = computeExecutionTriggerIntentCurrent({
    triggerIntent: executionTriggerIntent,
    contract: executorLaunchContract,
    bridge: executionBridgePayload,
    handoffRecord: businessLaunchHandoffRecord,
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: executorWorkOrder,
    sessionId,
  });
  const actualExecutionAdapterRequest = resolveSessionActualExecutionAdapterRequest(sessionId);
  const isActualExecutionAdapterRequestCurrent = computeActualExecutionAdapterRequestCurrent({
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
  const actualLaunchCommand = resolveSessionActualLaunchCommand(sessionId);
  const isActualLaunchCommandCurrent = computeActualLaunchCommandCurrent({
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
  const businessExecutionRun = resolveSessionBusinessExecutionRun(sessionId);
  const isBusinessExecutionRunCurrent = computeBusinessExecutionRunCurrent({
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
  const executorIntegrationAdapter = resolveSessionExecutorIntegrationAdapter(sessionId);
  const isExecutorIntegrationAdapterCurrent = computeExecutorIntegrationAdapterCurrent({
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
  const executorConnectorResult = resolveSessionExecutorConnectorResult(sessionId);
  const isExecutorConnectorResultCurrent = computeExecutorConnectorResultCurrent({
    result: executorConnectorResult,
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
  return {
    readinessMap,
    candidateTasks,
    snapshot,
    active,
    isSnapshotActive,
    launchReadiness,
    handoffPrepared,
    isHandoffPreparedActive,
    snapshotStaleness,
    handoffValidity,
    executionRequestDraft,
    hasExecutionRequestDraft,
    executionRequestApproval,
    isExecutionDraftApproved: isApproved,
    businessExecutionRequest,
    hasBusinessExecutionRequest,
    isBusinessExecutionRequestForCurrentSnapshot,
    businessExecutionRequestValidity,
    businessExecutionApproval,
    isBusinessExecutionApproved,
    businessExecutionPackage,
    isBusinessExecutionPackaged,
    executionAssignment,
    isExecutionPackageAssigned,
    executionAssignmentHandoffPayload,
    isExecutionAssignmentHandoffCurrent,
    executorIntakeContract,
    isExecutorIntakeContractCurrent,
    executorWorkOrder,
    isExecutorWorkOrderCurrent,
    executionReadiness,
    businessLaunchIntent,
    isBusinessLaunchIntentCurrent,
    businessLaunchHandoffRecord,
    isBusinessLaunchHandoffRecordCurrent,
    executionBridgePayload,
    isExecutionBridgePayloadCurrent,
    executorLaunchContract,
    isExecutorLaunchContractCurrent,
    executionTriggerIntent,
    isExecutionTriggerIntentCurrent,
    actualExecutionAdapterRequest,
    isActualExecutionAdapterRequestCurrent,
    actualLaunchCommand,
    isActualLaunchCommandCurrent,
    businessExecutionRun,
    isBusinessExecutionRunCurrent,
    executorIntegrationAdapter,
    isExecutorIntegrationAdapterCurrent,
    executorConnectorResult,
    isExecutorConnectorResultCurrent,
  };
}

