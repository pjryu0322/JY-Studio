/**
 * Business launch intent: explicit "will launch later" marker (NOT Stage1/Stage2, NOT actual launch).
 */

import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type BusinessLaunchIntent = {
  intentId: string;
  readinessId: string;
  workOrderId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  createdAtIso: string;
  status: "declared";
  source: "business_launch_intent";
  declaredBy?: "user" | "local";
  note?: string;
};

function intentId(): string {
  return `bizlint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function declareBusinessLaunchIntent(input: {
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder;
  declaredBy?: "user" | "local";
  note?: string;
}): BusinessLaunchIntent {
  if (input.readiness.status !== "ready") {
    throw new Error("declareBusinessLaunchIntent: execution readiness is not ready");
  }
  if (input.readiness.workOrderId !== input.workOrder.workOrderId) {
    throw new Error("declareBusinessLaunchIntent: readiness snapshot does not match work order");
  }
  if (input.readiness.sessionId && input.readiness.sessionId !== input.workOrder.sessionId) {
    throw new Error("declareBusinessLaunchIntent: readiness session does not match work order");
  }
  return {
    intentId: intentId(),
    readinessId: input.readiness.readinessId,
    workOrderId: input.workOrder.workOrderId,
    requirementId: input.workOrder.requirementId,
    sessionId: input.workOrder.sessionId,
    snapshotId: input.workOrder.snapshotId,
    createdAtIso: new Date().toISOString(),
    status: "declared",
    source: "business_launch_intent",
    declaredBy: input.declaredBy,
    note: input.note,
  };
}

/** Current intent: readiness is ready now and intent matches the active work order + session + snapshot. */
export function isBusinessLaunchIntentCurrent(input: {
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.sessionId || !input.intent || !input.workOrder) return false;
  if (input.readiness.status !== "ready") return false;
  return (
    input.intent.status === "declared" &&
    input.intent.source === "business_launch_intent" &&
    input.intent.workOrderId === input.workOrder.workOrderId &&
    input.intent.sessionId === input.sessionId &&
    input.intent.snapshotId === input.workOrder.snapshotId &&
    input.intent.requirementId === input.workOrder.requirementId
  );
}
