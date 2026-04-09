/**
 * Lightweight selectors for executor integration adapter (session scope).
 */

import type { ExecutorIntegrationAdapter } from "@/lib/workflow/executorIntegrationAdapter";
import { isExecutorIntegrationAdapterCurrent } from "@/lib/workflow/executorIntegrationAdapter";
import { getBusinessExecutionRunStateForSession } from "@/lib/workflow/businessExecutionRunGate";
import { resolveSessionExecutorIntegrationAdapter } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutorIntegrationAdapter(
  sessionId: string | null | undefined
): ExecutorIntegrationAdapter | undefined {
  return resolveSessionExecutorIntegrationAdapter(sessionId);
}

export { isExecutorIntegrationAdapterCurrent as isCurrentExecutorIntegrationAdapter };

export function getExecutorIntegrationStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getBusinessExecutionRunStateForSession> & {
  executorIntegrationAdapter: ExecutorIntegrationAdapter | undefined;
  isExecutorIntegrationAdapterCurrent: boolean;
} {
  const base = getBusinessExecutionRunStateForSession(sessionId, ctx);
  const executorIntegrationAdapter = resolveSessionExecutorIntegrationAdapter(sessionId);
  const isIntegrationCurrent = isExecutorIntegrationAdapterCurrent({
    integrationAdapter: executorIntegrationAdapter,
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
    executorIntegrationAdapter,
    isExecutorIntegrationAdapterCurrent: isIntegrationCurrent,
  };
}
