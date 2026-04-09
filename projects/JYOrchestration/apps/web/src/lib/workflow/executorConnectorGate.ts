/**
 * Lightweight selectors for executor connector result (session scope).
 */

import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import { isExecutorConnectorResultCurrent } from "@/lib/workflow/executorConnector";
import { getExecutorIntegrationStateForSession } from "@/lib/workflow/executorIntegrationAdapterGate";
import { resolveSessionExecutorConnectorResult } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutorConnectorResult(
  sessionId: string | null | undefined
): ExecutorConnectorResult | undefined {
  return resolveSessionExecutorConnectorResult(sessionId);
}

export { isExecutorConnectorResultCurrent as isCurrentExecutorConnectorResult };

export function getExecutorConnectorStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getExecutorIntegrationStateForSession> & {
  executorConnectorResult: ExecutorConnectorResult | undefined;
  isExecutorConnectorResultCurrent: boolean;
} {
  const base = getExecutorIntegrationStateForSession(sessionId, ctx);
  const executorConnectorResult = resolveSessionExecutorConnectorResult(sessionId);
  const isConnectorCurrent = isExecutorConnectorResultCurrent({
    result: executorConnectorResult,
    integrationAdapter: base.executorIntegrationAdapter,
    run: base.businessExecutionRun,
    command: base.actualLaunchCommand,
    adapter: base.actualExecutionAdapterRequest,
    triggerIntent: base.executionTriggerIntent,
    contract: base.executorLaunchContract,
    bridge: base.executionBridgePayload,
    handoffRecord: base.businessLaunchHandoffRecord,
    intent: base.businessLaunchIntent,
    readiness: base.executionReadiness,
    workOrder: base.workOrder,
    sessionId,
  });
  return {
    ...base,
    executorConnectorResult,
    isExecutorConnectorResultCurrent: isConnectorCurrent,
  };
}
