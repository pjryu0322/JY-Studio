/**
 * Business execution process actions: all workflow mutations for /execution.
 * Run start/control and connector invoke/retry are delegated to dedicated modules.
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import {
  approveBusinessExecutionRequest,
  assignBusinessExecutionPackage,
  createActualExecutionAdapterRequest,
  createActualLaunchCommand,
  createBusinessLaunchHandoffRecord,
  createBusinessExecutionPackage,
  createExecutionAssignmentHandoff,
  createExecutionBridgePayload,
  createExecutorIntakeContract,
  createExecutorLaunchContract,
  createExecutorWorkOrder,
  createExecutorIntegrationAdapter,
  declareBusinessLaunchIntent,
  declareExecutionTriggerIntent,
  recordSessionBusinessExecutionApproval,
  recordSessionBusinessExecutionPackage,
  recordSessionBusinessExecutionRequest,
  recordSessionActualExecutionAdapterRequest,
  recordSessionActualLaunchCommand,
  recordSessionBusinessLaunchHandoffRecord,
  recordSessionBusinessLaunchIntent,
  recordSessionExecutionAssignment,
  recordSessionExecutionAssignmentHandoffPayload,
  recordSessionExecutionBridgePayload,
  recordSessionExecutionRequestApproval,
  recordSessionExecutionRequestDraft,
  recordSessionExecutionTriggerIntent,
  recordSessionExecutorIntegrationAdapter,
  recordSessionExecutorIntakeContract,
  recordSessionExecutorLaunchContract,
  recordSessionExecutorWorkOrder,
  recordSessionHandoffPrepared,
  setActiveExecutionInput,
} from "@/lib/workflow/collaborationSessionResultStore";
import { createBusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import { approveExecutionRequestDraft } from "@/lib/workflow/executionRequestApproval";
import { createExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
import type { ExecutionPageActionState } from "@/lib/workflow/businessExecutionSelectors";
import type { PreExecutionSessionSelector } from "@/lib/workflow/preExecutionSelectors";
import { invokeExecutorConnectorForSession, retryExecutorConnectorForSession } from "@/lib/workflow/executionConnectorActions";
import {
  applyBusinessRunControlForSession,
  startBusinessExecutionForSession,
} from "@/lib/workflow/executionRunActions";

export type ExecutionProcessActionContext = {
  router: AppRouterInstance;
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  actions: ExecutionPageActionState;
};

function openTasks(router: AppRouterInstance, input: { requirementId: string | null; sessionId: string | null }) {
  const qs = new URLSearchParams();
  if (input.requirementId) qs.set("requirementId", input.requirementId);
  if (input.sessionId) qs.set("sessionId", input.sessionId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  router.push(`/tasks${suffix}`);
}

export function createExecutionProcessActions(ctx: ExecutionProcessActionContext) {
  const { router, sessionId, requirementId, pre, actions } = ctx;

  return {
    openTasks: () => openTasks(router, { requirementId, sessionId }),

    selectActiveInput: () => {
      if (!pre.snapshot) return;
      setActiveExecutionInput({ sessionId: pre.snapshot.sessionId, snapshotId: pre.snapshot.snapshotId });
    },

    prepareHandoffPrepared: () => {
      if (!pre.active) return;
      recordSessionHandoffPrepared(pre.active.sessionId, {
        sessionId: pre.active.sessionId,
        snapshotId: pre.active.snapshotId,
        preparedAtIso: new Date().toISOString(),
        status: "prepared",
      });
    },

    createExecutionRequestDraft: () => {
      if (!pre.snapshot) return;
      if (!pre.isHandoffPreparedActive) return;
      if (!pre.handoffValidity.isHandoffValid) return;
      recordSessionExecutionRequestDraft(pre.snapshot.sessionId, createExecutionRequestDraft({ snapshot: pre.snapshot }));
    },

    approveExecutionDraft: () => {
      if (!pre.executionRequestDraft) return;
      if (!pre.handoffValidity.isHandoffValid) return;
      const approval = approveExecutionRequestDraft({ draft: pre.executionRequestDraft, approvedBy: "local" });
      recordSessionExecutionRequestApproval(pre.executionRequestDraft.sessionId, approval);
    },

    recordBusinessExecutionRequest: () => {
      if (!pre.snapshot) return;
      if (!actions.canRecordBusinessRequest) return;
      recordSessionBusinessExecutionRequest(pre.snapshot.sessionId, createBusinessExecutionRequest({ snapshot: pre.snapshot }));
    },

    approveBusinessExecution: () => {
      if (!sessionId || !actions.canApproveBusinessExecution) return;
      if (!pre.businessExecutionRequest) return;
      const approval = approveBusinessExecutionRequest({ request: pre.businessExecutionRequest, approvedBy: "local" });
      recordSessionBusinessExecutionApproval(sessionId, approval);
    },

    createBusinessExecutionPackage: () => {
      if (!sessionId || !actions.canCreateBusinessPackage) return;
      if (!pre.businessExecutionRequest || !pre.businessExecutionApproval) return;
      const pkg = createBusinessExecutionPackage({
        request: pre.businessExecutionRequest,
        approval: pre.businessExecutionApproval,
      });
      recordSessionBusinessExecutionPackage(sessionId, pkg);
    },

    assignExecutor: (executorType: ExecutionExecutorType) => {
      if (!sessionId || !pre.businessExecutionPackage || !actions.canAssignExecutor) return;
      const next = assignBusinessExecutionPackage({
        pkg: pre.businessExecutionPackage,
        executorType,
        assignedBy: "local",
      });
      recordSessionExecutionAssignment(sessionId, next);
    },

    prepareExecutorHandoffPayload: () => {
      if (!sessionId || !actions.canCreateHandoffPayload) return;
      if (!pre.executionAssignment || !pre.businessExecutionPackage) return;
      const payload = createExecutionAssignmentHandoff({
        assignment: pre.executionAssignment,
        pkg: pre.businessExecutionPackage,
      });
      recordSessionExecutionAssignmentHandoffPayload(sessionId, payload);
    },

    prepareExecutorIntakeContract: () => {
      if (!sessionId || !actions.canCreateIntakeContract) return;
      if (!pre.executionAssignmentHandoffPayload) return;
      const contract = createExecutorIntakeContract({ handoff: pre.executionAssignmentHandoffPayload });
      recordSessionExecutorIntakeContract(sessionId, contract);
    },

    prepareExecutorWorkOrder: () => {
      if (!sessionId || !actions.canCreateWorkOrder) return;
      if (!pre.executorIntakeContract) return;
      const wo = createExecutorWorkOrder({ intake: pre.executorIntakeContract });
      recordSessionExecutorWorkOrder(sessionId, wo);
    },

    declareLaunchIntent: () => {
      if (!sessionId || !actions.canDeclareLaunchIntent) return;
      if (!pre.executorWorkOrder) return;
      const intent = declareBusinessLaunchIntent({
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        declaredBy: "local",
      });
      recordSessionBusinessLaunchIntent(sessionId, intent);
    },

    prepareLaunchHandoffRecord: () => {
      if (!sessionId || !actions.canRecordLaunchHandoff) return;
      if (!pre.businessLaunchIntent || !pre.executorWorkOrder) return;
      const record = createBusinessLaunchHandoffRecord({
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        sessionId,
        recordedBy: "local",
      });
      recordSessionBusinessLaunchHandoffRecord(sessionId, record);
    },

    prepareExecutionBridge: () => {
      if (!sessionId || !actions.canPrepareExecutionBridge) return;
      if (
        !pre.businessLaunchHandoffRecord ||
        !pre.businessLaunchIntent ||
        !pre.executorWorkOrder ||
        !pre.executorIntakeContract ||
        !pre.executionAssignment
      ) {
        return;
      }
      const bridge = createExecutionBridgePayload({
        handoffRecord: pre.businessLaunchHandoffRecord,
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        intake: pre.executorIntakeContract,
        assignment: pre.executionAssignment,
        sessionId,
      });
      recordSessionExecutionBridgePayload(sessionId, bridge);
    },

    prepareExecutorLaunchContract: () => {
      if (!sessionId || !actions.canPrepareLaunchContract) return;
      if (!pre.executionBridgePayload) return;
      const contract = createExecutorLaunchContract({
        bridge: pre.executionBridgePayload,
        handoffRecord: pre.businessLaunchHandoffRecord,
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        sessionId,
      });
      recordSessionExecutorLaunchContract(sessionId, contract);
    },

    markExecutionTriggerIntent: () => {
      if (!sessionId || !actions.canDeclareExecutionTriggerIntent) return;
      if (!pre.executorLaunchContract || !pre.executionBridgePayload) return;
      const intent = declareExecutionTriggerIntent({
        contract: pre.executorLaunchContract,
        bridge: pre.executionBridgePayload,
        handoffRecord: pre.businessLaunchHandoffRecord,
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        sessionId,
        declaredBy: "local",
      });
      recordSessionExecutionTriggerIntent(sessionId, intent);
    },

    prepareActualExecutionAdapter: () => {
      if (!sessionId || !actions.canPrepareExecutionAdapter) return;
      if (!pre.executionTriggerIntent || !pre.executorLaunchContract || !pre.executionBridgePayload) return;
      const adapter = createActualExecutionAdapterRequest({
        triggerIntent: pre.executionTriggerIntent,
        contract: pre.executorLaunchContract,
        bridge: pre.executionBridgePayload,
        handoffRecord: pre.businessLaunchHandoffRecord,
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        sessionId,
      });
      recordSessionActualExecutionAdapterRequest(sessionId, adapter);
    },

    prepareActualLaunchCommand: () => {
      if (!sessionId || !actions.canPrepareLaunchCommand) return;
      if (!pre.actualExecutionAdapterRequest || !pre.executionTriggerIntent || !pre.executorLaunchContract || !pre.executionBridgePayload) return;
      const command = createActualLaunchCommand({
        adapter: pre.actualExecutionAdapterRequest,
        triggerIntent: pre.executionTriggerIntent,
        contract: pre.executorLaunchContract,
        bridge: pre.executionBridgePayload,
        handoffRecord: pre.businessLaunchHandoffRecord,
        intent: pre.businessLaunchIntent,
        readiness: pre.executionReadiness,
        workOrder: pre.executorWorkOrder,
        sessionId,
      });
      recordSessionActualLaunchCommand(sessionId, command);
    },

    startBusinessExecution: () =>
      startBusinessExecutionForSession({ sessionId, canStart: actions.canStartBusinessExecution, pre }),

    applyBusinessRunControl: (kind: "running" | "completed" | "failed") =>
      applyBusinessRunControlForSession({ sessionId, pre, kind }),

    prepareExecutorIntegrationAdapter: () => {
      if (!sessionId || !actions.canPrepareExecutorIntegrationAdapter) return;
      if (!pre.businessExecutionRun || !pre.actualLaunchCommand) return;
      try {
        const adapter = createExecutorIntegrationAdapter({
          run: pre.businessExecutionRun,
          command: pre.actualLaunchCommand,
          adapter: pre.actualExecutionAdapterRequest,
          triggerIntent: pre.executionTriggerIntent,
          contract: pre.executorLaunchContract,
          bridge: pre.executionBridgePayload,
          handoffRecord: pre.businessLaunchHandoffRecord,
          intent: pre.businessLaunchIntent,
          readiness: pre.executionReadiness,
          workOrder: pre.executorWorkOrder,
          sessionId,
        });
        recordSessionExecutorIntegrationAdapter(sessionId, adapter);
      } catch {
        /* run not current or invalid chain */
      }
    },

    runExecutorConnector: () => invokeExecutorConnectorForSession({ sessionId, pre, actions }),

    retryExecutorConnector: () => retryExecutorConnectorForSession({ sessionId, pre, actions }),
  };
}
