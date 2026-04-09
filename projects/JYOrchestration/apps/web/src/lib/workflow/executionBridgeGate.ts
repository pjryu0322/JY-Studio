/**
 * Lightweight selectors for execution bridge payload (pre-execution only).
 */

import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import { isExecutionBridgePayloadCurrent } from "@/lib/workflow/executionBridgePayload";
import { getBusinessLaunchHandoffStateForSession } from "@/lib/workflow/businessLaunchHandoffGate";
import { resolveSessionExecutionBridgePayload } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutionBridgePayload(
  sessionId: string | null | undefined
): ExecutionBridgePayload | undefined {
  return resolveSessionExecutionBridgePayload(sessionId);
}

export { isExecutionBridgePayloadCurrent as isCurrentExecutionBridgePayload };

export function getExecutionBridgeStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getBusinessLaunchHandoffStateForSession> & {
  executionBridgePayload: ExecutionBridgePayload | undefined;
  isExecutionBridgePayloadCurrent: boolean;
} {
  const base = getBusinessLaunchHandoffStateForSession(sessionId, ctx);
  const executionBridgePayload = resolveSessionExecutionBridgePayload(sessionId);
  const isBridgeCurrent = isExecutionBridgePayloadCurrent({
    bridge: executionBridgePayload,
    handoffRecord: base.businessLaunchHandoffRecord,
    intent: base.businessLaunchIntent,
    readiness: base.executionReadiness,
    workOrder: base.workOrder,
    sessionId,
  });
  return {
    ...base,
    executionBridgePayload,
    isExecutionBridgePayloadCurrent: isBridgeCurrent,
  };
}
