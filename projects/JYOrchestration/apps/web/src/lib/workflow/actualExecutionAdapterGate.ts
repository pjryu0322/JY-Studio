/**
 * Lightweight selectors for actual execution adapter request (pre-execution only).
 */

import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import { isActualExecutionAdapterRequestCurrent } from "@/lib/workflow/actualExecutionAdapter";
import { getExecutionTriggerIntentStateForSession } from "@/lib/workflow/executionTriggerIntentGate";
import { resolveSessionActualExecutionAdapterRequest } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveActualExecutionAdapterRequest(
  sessionId: string | null | undefined
): ActualExecutionAdapterRequest | undefined {
  return resolveSessionActualExecutionAdapterRequest(sessionId);
}

export { isActualExecutionAdapterRequestCurrent as isCurrentActualExecutionAdapterRequest };

export function getActualExecutionAdapterStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getExecutionTriggerIntentStateForSession> & {
  actualExecutionAdapterRequest: ActualExecutionAdapterRequest | undefined;
  isActualExecutionAdapterRequestCurrent: boolean;
} {
  const base = getExecutionTriggerIntentStateForSession(sessionId, ctx);
  const actualExecutionAdapterRequest = resolveSessionActualExecutionAdapterRequest(sessionId);
  const isAdapterCurrent = isActualExecutionAdapterRequestCurrent({
    adapter: actualExecutionAdapterRequest,
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
    actualExecutionAdapterRequest,
    isActualExecutionAdapterRequestCurrent: isAdapterCurrent,
  };
}
