/**
 * Executor connector invoke/retry orchestration for business execution.
 * Keeps invoke → events → pilot run mutation → persisted result in one place.
 */

import {
  appendSessionBusinessExecutionRunEvent,
  invokeExecutorConnector,
  recordSessionExecutorConnectorResult,
} from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState } from "@/lib/workflow/businessExecutionSelectors";
import type { PreExecutionSessionSelector } from "@/lib/workflow/preExecutionSelectors";
import { createRetryRequestedEvent, createRetryStartedEvent } from "@/lib/workflow/businessExecutionRunEvent";
import { recordConnectorInvocationEffects } from "@/lib/workflow/executionRunActions";

export function invokeExecutorConnectorForSession(input: {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  actions: ExecutionPageActionState;
}): void {
  const { sessionId, pre, actions } = input;
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
    recordConnectorInvocationEffects({ sessionId, pre, result });
    recordSessionExecutorConnectorResult(sessionId, result);
  } catch {
    /* adapter not current */
  }
}

export function retryExecutorConnectorForSession(input: {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  actions: ExecutionPageActionState;
}): void {
  const { sessionId, pre, actions } = input;
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
    recordConnectorInvocationEffects({ sessionId, pre, result });
    recordSessionExecutorConnectorResult(sessionId, result);
  } catch {
    /* adapter not current */
  }
}
