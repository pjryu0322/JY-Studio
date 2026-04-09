/**
 * Business Execution domain selectors: compose session state and page-level derived action flags.
 *
 * Prefer these entry points over ad hoc store stitching in UI. Stage1/Stage2 test flow state must not
 * be folded into these selectors.
 */

import { isBusinessApprovalForRequest } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import {
  getPreExecutionStateForSession,
  type PreExecutionSessionSelector,
} from "@/lib/workflow/preExecutionSelectors";
import { resolveCoreEntityChainForSession } from "@/lib/workflow/businessExecutionEntityRepository";

export type { PreExecutionSessionSelector };

/** Canonical read of business + pre-execution session state (entities + derived currency flags). */
export function getBusinessExecutionSessionState(
  sessionId: string | null | undefined
): PreExecutionSessionSelector {
  return getPreExecutionStateForSession(sessionId);
}

/**
 * Explicit latest/current policy for core persisted entities (latest-only in this phase).
 * This function exists to make entity currency rules obvious and centrally testable.
 */
export function resolveBusinessExecutionCoreEntities(sessionId: string | null | undefined) {
  return resolveCoreEntityChainForSession(sessionId);
}

/** Derived gating flags for /execution (pure; no I/O). */
export type ExecutionPageActionState = {
  canRecordBusinessRequest: boolean;
  businessRequestNeedsAttention: boolean;
  businessRequestValid: boolean;
  canApproveBusinessExecution: boolean;
  hasOrphanBusinessApproval: boolean;
  canCreateBusinessPackage: boolean;
  hasNonCurrentPackage: boolean;
  canAssignExecutor: boolean;
  hasNonCurrentAssignment: boolean;
  canCreateHandoffPayload: boolean;
  hasNonCurrentHandoffPayload: boolean;
  canCreateIntakeContract: boolean;
  hasNonCurrentIntakeContract: boolean;
  canCreateWorkOrder: boolean;
  hasNonCurrentWorkOrder: boolean;
  canDeclareLaunchIntent: boolean;
  hasNonCurrentLaunchIntent: boolean;
  canRecordLaunchHandoff: boolean;
  hasStaleLaunchHandoffRecord: boolean;
  canPrepareExecutionBridge: boolean;
  hasStaleExecutionBridgePayload: boolean;
  canPrepareLaunchContract: boolean;
  hasStaleExecutorLaunchContract: boolean;
  canDeclareExecutionTriggerIntent: boolean;
  hasStaleExecutionTriggerIntent: boolean;
  canPrepareExecutionAdapter: boolean;
  hasStaleActualExecutionAdapterRequest: boolean;
  canPrepareLaunchCommand: boolean;
  hasStaleActualLaunchCommand: boolean;
  blockedByActiveBusinessRun: boolean;
  canStartBusinessExecution: boolean;
  hasStaleBusinessExecutionRun: boolean;
  invocationPrimaryLabel: string;
  canPrepareExecutorIntegrationAdapter: boolean;
  hasStaleExecutorIntegrationAdapter: boolean;
  canInvokeExecutorConnector: boolean;
  hasStaleExecutorConnectorResult: boolean;
  canRetryExecutorConnector: boolean;
};

export function buildExecutionPageActionState(
  pre: PreExecutionSessionSelector,
  monitoring: BusinessExecutionMonitoringState
): ExecutionPageActionState {
  const snapshot = pre.snapshot;
  const handoffValidity = pre.handoffValidity;
  const isDraftApproved = pre.isExecutionDraftApproved;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const bizReqValidity = pre.businessExecutionRequestValidity;
  const businessExecutionRequest = pre.businessExecutionRequest;
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

  const blockedByActiveBusinessRun = monitoring.blockedByActiveCurrentRun;
  const invocationPrimaryLabel = blockedByActiveBusinessRun
    ? "Run in progress"
    : monitoring.storedRun && (!monitoring.isRunCurrent || monitoring.view?.isTerminal)
      ? "Retry"
      : "Start business execution";

  return {
    canRecordBusinessRequest:
      Boolean(snapshot) && handoffValidity.isHandoffValid && isDraftApproved && isHandoffPrepared,
    businessRequestNeedsAttention:
      bizReqValidity?.status === "stale" || bizReqValidity?.status === "invalid",
    businessRequestValid: bizReqValidity?.status === "requested",
    canApproveBusinessExecution:
      Boolean(businessExecutionRequest) && bizReqValidity?.status === "requested" && !isBusinessExecutionApproved,
    hasOrphanBusinessApproval:
      Boolean(businessExecutionRequest && businessExecutionApproval) &&
      !isBusinessApprovalForRequest(businessExecutionRequest, businessExecutionApproval),
    canCreateBusinessPackage: isBusinessExecutionApproved && !isBusinessExecutionPackaged,
    hasNonCurrentPackage: Boolean(businessExecutionPackage) && !isBusinessExecutionPackaged,
    canAssignExecutor: isBusinessExecutionPackaged,
    hasNonCurrentAssignment:
      Boolean(executionAssignment) && !isExecutionPackageAssigned && isBusinessExecutionPackaged,
    canCreateHandoffPayload: isExecutionPackageAssigned && !isExecutionAssignmentHandoffCurrent,
    hasNonCurrentHandoffPayload:
      Boolean(executionAssignmentHandoffPayload) &&
      !isExecutionAssignmentHandoffCurrent &&
      isExecutionPackageAssigned,
    canCreateIntakeContract: isExecutionAssignmentHandoffCurrent && !isExecutorIntakeContractCurrent,
    hasNonCurrentIntakeContract:
      Boolean(executorIntakeContract) &&
      !isExecutorIntakeContractCurrent &&
      isExecutionAssignmentHandoffCurrent,
    canCreateWorkOrder: isExecutorIntakeContractCurrent && !isExecutorWorkOrderCurrent,
    hasNonCurrentWorkOrder:
      Boolean(executorWorkOrder) && !isExecutorWorkOrderCurrent && isExecutorIntakeContractCurrent,
    canDeclareLaunchIntent: executionReadiness.status === "ready" && !isBusinessLaunchIntentCurrent,
    hasNonCurrentLaunchIntent:
      Boolean(businessLaunchIntent) &&
      !isBusinessLaunchIntentCurrent &&
      executionReadiness.status === "ready",
    canRecordLaunchHandoff: isBusinessLaunchIntentCurrent && !isBusinessLaunchHandoffRecordCurrent,
    hasStaleLaunchHandoffRecord:
      Boolean(businessLaunchHandoffRecord) && !isBusinessLaunchHandoffRecordCurrent,
    canPrepareExecutionBridge: isBusinessLaunchHandoffRecordCurrent && !isExecutionBridgePayloadCurrent,
    hasStaleExecutionBridgePayload:
      Boolean(executionBridgePayload) && !isExecutionBridgePayloadCurrent,
    canPrepareLaunchContract: isExecutionBridgePayloadCurrent && !isExecutorLaunchContractCurrent,
    hasStaleExecutorLaunchContract:
      Boolean(executorLaunchContract) && !isExecutorLaunchContractCurrent,
    canDeclareExecutionTriggerIntent:
      isExecutorLaunchContractCurrent && !isExecutionTriggerIntentCurrent,
    hasStaleExecutionTriggerIntent:
      Boolean(executionTriggerIntent) && !isExecutionTriggerIntentCurrent,
    canPrepareExecutionAdapter:
      isExecutionTriggerIntentCurrent && !isActualExecutionAdapterRequestCurrent,
    hasStaleActualExecutionAdapterRequest:
      Boolean(actualExecutionAdapterRequest) && !isActualExecutionAdapterRequestCurrent,
    canPrepareLaunchCommand:
      isActualExecutionAdapterRequestCurrent && !isActualLaunchCommandCurrent,
    hasStaleActualLaunchCommand: Boolean(actualLaunchCommand) && !isActualLaunchCommandCurrent,
    blockedByActiveBusinessRun,
    canStartBusinessExecution: monitoring.canInvokeOrRetryRun,
    hasStaleBusinessExecutionRun: monitoring.hasStoredRunNotCurrent,
    invocationPrimaryLabel,
    canPrepareExecutorIntegrationAdapter:
      isBusinessExecutionRunCurrent && Boolean(businessExecutionRun) && !isExecutorIntegrationAdapterCurrent,
    hasStaleExecutorIntegrationAdapter:
      Boolean(executorIntegrationAdapter) && !isExecutorIntegrationAdapterCurrent,
    canInvokeExecutorConnector:
      isExecutorIntegrationAdapterCurrent &&
      Boolean(executorIntegrationAdapter) &&
      Boolean(businessExecutionRun) &&
      !isExecutorConnectorResultCurrent,
    hasStaleExecutorConnectorResult:
      Boolean(executorConnectorResult) && !isExecutorConnectorResultCurrent,
    canRetryExecutorConnector:
      isExecutorIntegrationAdapterCurrent &&
      Boolean(executorIntegrationAdapter) &&
      isExecutorConnectorResultCurrent &&
      executorConnectorResult?.status === "failed",
  };
}
