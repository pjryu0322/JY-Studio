/**
 * Lightweight selectors for business execution run.
 */

import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import { isBusinessExecutionRunCurrent } from "@/lib/workflow/businessExecutionRun";
import { getActualLaunchCommandStateForSession } from "@/lib/workflow/actualLaunchCommandGate";
import { resolveSessionBusinessExecutionRun } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveBusinessExecutionRun(
  sessionId: string | null | undefined
): BusinessExecutionRun | undefined {
  return resolveSessionBusinessExecutionRun(sessionId);
}

export { isBusinessExecutionRunCurrent as isCurrentBusinessExecutionRun };

export function getBusinessExecutionRunStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getActualLaunchCommandStateForSession> & {
  businessExecutionRun: BusinessExecutionRun | undefined;
  isBusinessExecutionRunCurrent: boolean;
} {
  const base = getActualLaunchCommandStateForSession(sessionId, ctx);
  const businessExecutionRun = resolveSessionBusinessExecutionRun(sessionId);
  const isRunCurrent = isBusinessExecutionRunCurrent({
    run: businessExecutionRun,
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
    businessExecutionRun,
    isBusinessExecutionRunCurrent: isRunCurrent,
  };
}
