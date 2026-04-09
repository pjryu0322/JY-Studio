/**
 * Lightweight selectors for executor launch contract (pre-execution only).
 */

import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import { isExecutorLaunchContractCurrent } from "@/lib/workflow/executorLaunchContract";
import { getExecutionBridgeStateForSession } from "@/lib/workflow/executionBridgeGate";
import { resolveSessionExecutorLaunchContract } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutorLaunchContract(
  sessionId: string | null | undefined
): ExecutorLaunchContract | undefined {
  return resolveSessionExecutorLaunchContract(sessionId);
}

export { isExecutorLaunchContractCurrent as isCurrentExecutorLaunchContract };

export function getExecutorLaunchContractStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getExecutionBridgeStateForSession> & {
  executorLaunchContract: ExecutorLaunchContract | undefined;
  isExecutorLaunchContractCurrent: boolean;
} {
  const base = getExecutionBridgeStateForSession(sessionId, ctx);
  const executorLaunchContract = resolveSessionExecutorLaunchContract(sessionId);
  const isLaunchContractCurrent = isExecutorLaunchContractCurrent({
    contract: executorLaunchContract,
    bridge: base.executionBridgePayload,
    handoffRecord: base.businessLaunchHandoffRecord,
    intent: base.businessLaunchIntent,
    readiness: base.executionReadiness,
    workOrder: base.workOrder,
    sessionId,
  });
  return {
    ...base,
    executorLaunchContract,
    isExecutorLaunchContractCurrent: isLaunchContractCurrent,
  };
}
