/**
 * Lightweight selectors for execution trigger intent (pre-execution only).
 */

import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import { isExecutionTriggerIntentCurrent } from "@/lib/workflow/executionTriggerIntent";
import { getExecutorLaunchContractStateForSession } from "@/lib/workflow/executorLaunchContractGate";
import { resolveSessionExecutionTriggerIntent } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutionTriggerIntent(
  sessionId: string | null | undefined
): ExecutionTriggerIntent | undefined {
  return resolveSessionExecutionTriggerIntent(sessionId);
}

export { isExecutionTriggerIntentCurrent as isCurrentExecutionTriggerIntent };

export function getExecutionTriggerIntentStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getExecutorLaunchContractStateForSession> & {
  executionTriggerIntent: ExecutionTriggerIntent | undefined;
  isExecutionTriggerIntentCurrent: boolean;
} {
  const base = getExecutorLaunchContractStateForSession(sessionId, ctx);
  const executionTriggerIntent = resolveSessionExecutionTriggerIntent(sessionId);
  const isTriggerCurrent = isExecutionTriggerIntentCurrent({
    triggerIntent: executionTriggerIntent,
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
    executionTriggerIntent,
    isExecutionTriggerIntentCurrent: isTriggerCurrent,
  };
}
