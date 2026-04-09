/**
 * Execution trigger intent: explicit “will trigger later” marker on a launch contract (NOT Stage1/Stage2, NOT launch).
 */

import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import { isExecutorLaunchContractCurrent } from "@/lib/workflow/executorLaunchContract";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type ExecutionTriggerIntent = {
  triggerIntentId: string;
  launchContractId: string;
  bridgeId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  createdAtIso: string;
  status: "declared";
  source: "execution_trigger_intent";
  declaredBy?: "user" | "local";
  note?: string;
};

function nextTriggerIntentId(): string {
  return `extrgint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function declareExecutionTriggerIntent(input: {
  contract: ExecutorLaunchContract;
  bridge: ExecutionBridgePayload;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
  declaredBy?: "user" | "local";
  note?: string;
}): ExecutionTriggerIntent {
  if (
    !isExecutorLaunchContractCurrent({
      contract: input.contract,
      bridge: input.bridge,
      handoffRecord: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    throw new Error("declareExecutionTriggerIntent: executor launch contract is not current");
  }
  if (input.contract.sessionId !== input.sessionId) {
    throw new Error("declareExecutionTriggerIntent: contract session mismatch");
  }
  return {
    triggerIntentId: nextTriggerIntentId(),
    launchContractId: input.contract.launchContractId,
    bridgeId: input.contract.bridgeId,
    executorType: input.contract.executorType,
    requirementId: input.contract.requirementId,
    sessionId: input.contract.sessionId,
    snapshotId: input.contract.snapshotId,
    createdAtIso: new Date().toISOString(),
    status: "declared",
    source: "execution_trigger_intent",
    declaredBy: input.declaredBy,
    note: input.note,
  };
}

export function isExecutionTriggerIntentCurrent(input: {
  triggerIntent: ExecutionTriggerIntent | undefined;
  contract: ExecutorLaunchContract | undefined;
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.triggerIntent || !input.contract || !input.bridge || !input.sessionId) return false;
  if (
    !isExecutorLaunchContractCurrent({
      contract: input.contract,
      bridge: input.bridge,
      handoffRecord: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    return false;
  }
  return (
    input.triggerIntent.status === "declared" &&
    input.triggerIntent.source === "execution_trigger_intent" &&
    input.triggerIntent.launchContractId === input.contract.launchContractId &&
    input.triggerIntent.bridgeId === input.bridge.bridgeId &&
    input.triggerIntent.sessionId === input.sessionId &&
    input.triggerIntent.snapshotId === input.contract.snapshotId &&
    input.triggerIntent.executorType === input.contract.executorType &&
    input.triggerIntent.requirementId === input.contract.requirementId
  );
}
