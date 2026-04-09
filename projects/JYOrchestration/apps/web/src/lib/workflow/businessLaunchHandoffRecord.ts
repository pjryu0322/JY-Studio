/**
 * Business launch handoff record: formal handoff-ready artifact (NOT Stage1/Stage2, NOT launch).
 */

import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import { isBusinessLaunchIntentCurrent, type BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type BusinessLaunchHandoffRecord = {
  handoffRecordId: string;
  intentId: string;
  readinessId: string;
  workOrderId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  createdAtIso: string;
  status: "recorded";
  source: "business_launch_handoff";
  recordedBy?: "user" | "local";
  note?: string;
};

function handoffRecordId(): string {
  return `bizlhof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBusinessLaunchHandoffRecord(input: {
  intent: BusinessLaunchIntent;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder;
  sessionId: string;
  recordedBy?: "user" | "local";
  note?: string;
}): BusinessLaunchHandoffRecord {
  if (!isBusinessLaunchIntentCurrent({
    intent: input.intent,
    readiness: input.readiness,
    workOrder: input.workOrder,
    sessionId: input.sessionId,
  })) {
    throw new Error("createBusinessLaunchHandoffRecord: launch intent is not current for this session");
  }
  if (input.intent.sessionId !== input.sessionId) {
    throw new Error("createBusinessLaunchHandoffRecord: intent session mismatch");
  }
  return {
    handoffRecordId: handoffRecordId(),
    intentId: input.intent.intentId,
    readinessId: input.readiness.readinessId,
    workOrderId: input.intent.workOrderId,
    requirementId: input.intent.requirementId,
    sessionId: input.intent.sessionId,
    snapshotId: input.intent.snapshotId,
    createdAtIso: new Date().toISOString(),
    status: "recorded",
    source: "business_launch_handoff",
    recordedBy: input.recordedBy,
    note: input.note,
  };
}

export function isBusinessLaunchHandoffRecordCurrent(input: {
  record: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.record || !input.intent || !input.workOrder || !input.sessionId) return false;
  if (
    !isBusinessLaunchIntentCurrent({
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    return false;
  }
  return (
    input.record.status === "recorded" &&
    input.record.source === "business_launch_handoff" &&
    input.record.intentId === input.intent.intentId &&
    input.record.readinessId === input.intent.readinessId &&
    input.record.workOrderId === input.intent.workOrderId &&
    input.record.sessionId === input.sessionId &&
    input.record.snapshotId === input.workOrder.snapshotId &&
    input.record.requirementId === input.intent.requirementId
  );
}
