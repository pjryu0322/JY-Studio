/**
 * /execution orchestration actions (Business Execution domain).
 *
 * Keep UI thin: this module encapsulates record/update calls, connector invocation/retry,
 * run control, and run timeline append behavior.
 *
 * NOT Stage1/Stage2. No Git/PR/merge here.
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
  declareBusinessLaunchIntent,
  declareExecutionTriggerIntent,
  invokeBusinessExecution,
  invokeExecutorConnector,
  markBusinessExecutionRunCompleted,
  markBusinessExecutionRunFailed,
  markBusinessExecutionRunRunning,
  createExecutorIntegrationAdapter,
  recordSessionBusinessExecutionApproval,
  recordSessionBusinessExecutionPackage,
  recordSessionBusinessExecutionRequest,
  recordSessionActualExecutionAdapterRequest,
  recordSessionActualLaunchCommand,
  recordSessionBusinessExecutionRun,
  recordSessionBusinessLaunchHandoffRecord,
  recordSessionBusinessLaunchIntent,
  recordSessionExecutionAssignment,
  recordSessionExecutionAssignmentHandoffPayload,
  recordSessionExecutionBridgePayload,
  recordSessionExecutionRequestApproval,
  recordSessionExecutionRequestDraft,
  recordSessionExecutionTriggerIntent,
  recordSessionExecutorConnectorResult,
  recordSessionExecutorIntegrationAdapter,
  recordSessionExecutorIntakeContract,
  recordSessionExecutorLaunchContract,
  recordSessionExecutorWorkOrder,
  recordSessionHandoffPrepared,
  applyExecutorConnectorResultToBusinessExecutionRun,
  appendSessionBusinessExecutionRunEvent,
  setActiveExecutionInput,
} from "@/lib/workflow/collaborationSessionResultStore";
import { createBusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import { approveExecutionRequestDraft } from "@/lib/workflow/executionRequestApproval";
import { createExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
import {
  createRetryRequestedEvent,
  createRetryStartedEvent,
  createRunCreatedEvent,
  createRunEventFromConnectorResult,
  createTerminalRunEventFromStatus,
} from "@/lib/workflow/businessExecutionRunEvent";
import type { ExecutionPageActionState } from "@/lib/workflow/businessExecutionSelectors";
import type { PreExecutionSessionSelector } from "@/lib/workflow/preExecutionSelectors";

export type ExecutionPageActionContext = {
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

export function createExecutionPageActions(ctx: ExecutionPageActionContext) {
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

    startBusinessExecution: () => {
      if (!sessionId || !actions.canStartBusinessExecution) return;
      if (!pre.actualLaunchCommand || !pre.actualExecutionAdapterRequest || !pre.executionTriggerIntent || !pre.executorLaunchContract || !pre.executionBridgePayload) return;
      const run = invokeBusinessExecution({
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
      recordSessionBusinessExecutionRun(sessionId, run);
      appendSessionBusinessExecutionRunEvent(sessionId, run.runId, createRunCreatedEvent(run));
    },

    applyBusinessRunControl: (kind: "running" | "completed" | "failed") => {
      if (!sessionId || !pre.businessExecutionRun || !pre.isBusinessExecutionRunCurrent) return;
      try {
        const next =
          kind === "running"
            ? markBusinessExecutionRunRunning(pre.businessExecutionRun)
            : kind === "completed"
              ? markBusinessExecutionRunCompleted(pre.businessExecutionRun)
              : markBusinessExecutionRunFailed(pre.businessExecutionRun);
        recordSessionBusinessExecutionRun(sessionId, next);
      } catch {
        /* invalid transition — ignore */
      }
    },

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

    runExecutorConnector: () => {
      if (!sessionId || !actions.canInvokeExecutorConnector) return;
      if (!pre.executorIntegrationAdapter || !pre.businessExecutionRun || !pre.actualLaunchCommand) return;
      try {
        const result = invokeExecutorConnector({
          integrationAdapter: pre.executorIntegrationAdapter,
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
        appendSessionBusinessExecutionRunEvent(
          sessionId,
          pre.businessExecutionRun.runId,
          createRunEventFromConnectorResult({ run: pre.businessExecutionRun, result })
        );
        if ((result.executorType === "cursor_executor" || result.executorType === "reviewer") && pre.isBusinessExecutionRunCurrent) {
          const nextRun = applyExecutorConnectorResultToBusinessExecutionRun({
            run: pre.businessExecutionRun,
            connectorResult: result,
          });
          recordSessionBusinessExecutionRun(sessionId, nextRun);
          const terminal = createTerminalRunEventFromStatus(nextRun);
          if (terminal) appendSessionBusinessExecutionRunEvent(sessionId, nextRun.runId, terminal);
        }
        recordSessionExecutorConnectorResult(sessionId, result);
      } catch {
        /* adapter not current */
      }
    },

    retryExecutorConnector: () => {
      if (!sessionId || !actions.canRetryExecutorConnector) return;
      if (!pre.executorIntegrationAdapter || !pre.businessExecutionRun || !pre.actualLaunchCommand) return;
      try {
        appendSessionBusinessExecutionRunEvent(sessionId, pre.businessExecutionRun.runId, createRetryRequestedEvent(pre.businessExecutionRun));
        appendSessionBusinessExecutionRunEvent(sessionId, pre.businessExecutionRun.runId, createRetryStartedEvent(pre.businessExecutionRun));
        const result = invokeExecutorConnector({
          integrationAdapter: pre.executorIntegrationAdapter,
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
        appendSessionBusinessExecutionRunEvent(
          sessionId,
          pre.businessExecutionRun.runId,
          createRunEventFromConnectorResult({ run: pre.businessExecutionRun, result })
        );
        if ((result.executorType === "cursor_executor" || result.executorType === "reviewer") && pre.isBusinessExecutionRunCurrent) {
          const nextRun = applyExecutorConnectorResultToBusinessExecutionRun({
            run: pre.businessExecutionRun,
            connectorResult: result,
          });
          recordSessionBusinessExecutionRun(sessionId, nextRun);
          const terminal = createTerminalRunEventFromStatus(nextRun);
          if (terminal) appendSessionBusinessExecutionRunEvent(sessionId, nextRun.runId, terminal);
        }
        recordSessionExecutorConnectorResult(sessionId, result);
      } catch {
        /* adapter not current */
      }
    },
  };
}

