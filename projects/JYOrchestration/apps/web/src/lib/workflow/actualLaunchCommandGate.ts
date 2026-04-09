/**
 * Lightweight selectors for actual launch command (pre-execution only).
 */

import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import { isActualLaunchCommandCurrent } from "@/lib/workflow/actualLaunchCommand";
import { getActualExecutionAdapterStateForSession } from "@/lib/workflow/actualExecutionAdapterGate";
import { resolveSessionActualLaunchCommand } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveActualLaunchCommand(
  sessionId: string | null | undefined
): ActualLaunchCommand | undefined {
  return resolveSessionActualLaunchCommand(sessionId);
}

export { isActualLaunchCommandCurrent as isCurrentActualLaunchCommand };

export function getActualLaunchCommandStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getActualExecutionAdapterStateForSession> & {
  actualLaunchCommand: ActualLaunchCommand | undefined;
  isActualLaunchCommandCurrent: boolean;
} {
  const base = getActualExecutionAdapterStateForSession(sessionId, ctx);
  const actualLaunchCommand = resolveSessionActualLaunchCommand(sessionId);
  const isCommandCurrent = isActualLaunchCommandCurrent({
    command: actualLaunchCommand,
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
    actualLaunchCommand,
    isActualLaunchCommandCurrent: isCommandCurrent,
  };
}
