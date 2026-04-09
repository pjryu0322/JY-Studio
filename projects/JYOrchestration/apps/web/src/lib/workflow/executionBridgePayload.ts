/**
 * Business-to-execution bridge payload (NOT Stage1/Stage2, NOT launch).
 * Structured artifact for a future execution consumer from a current handoff record.
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import { isBusinessLaunchHandoffRecordCurrent } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionAssignment, ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorIntakeContract, ExecutorIntakeShapedPayload } from "@/lib/workflow/executorIntakeContract";
import { executorIntakePreviewLine } from "@/lib/workflow/executorIntakeContract";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type ExecutionBridgeContext = {
  workOrder: {
    title: string;
    objective: string;
    workInstructions: string;
    successCriteria: string;
  };
  intakeHints: {
    shaped: ExecutorIntakeShapedPayload;
    summary?: string;
    note?: string;
    previewLine: string;
  };
  assignment: {
    assignmentId: string;
    packageId: string;
    requestId: string;
    executorType: ExecutionExecutorType;
    assignedAtIso: string;
  };
};

export type ExecutionBridgePayload = {
  bridgeId: string;
  handoffRecordId: string;
  intentId: string;
  workOrderId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  executorType: ExecutionExecutorType;
  candidateTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  executionContext: ExecutionBridgeContext;
  createdAtIso: string;
  status: "bridge_ready";
  source: "business_execution_bridge";
};

function nextBridgeId(): string {
  return `bizbridge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildExecutionContext(input: {
  workOrder: ExecutorWorkOrder;
  intake: ExecutorIntakeContract;
  assignment: ExecutionAssignment;
}): ExecutionBridgeContext {
  return {
    workOrder: {
      title: input.workOrder.title,
      objective: input.workOrder.objective,
      workInstructions: input.workOrder.workInstructions,
      successCriteria: input.workOrder.successCriteria,
    },
    intakeHints: {
      shaped: input.intake.shaped,
      summary: input.intake.summary,
      note: input.intake.note,
      previewLine: executorIntakePreviewLine(input.intake),
    },
    assignment: {
      assignmentId: input.assignment.assignmentId,
      packageId: input.assignment.packageId,
      requestId: input.assignment.requestId,
      executorType: input.assignment.executorType,
      assignedAtIso: input.assignment.assignedAtIso,
    },
  };
}

function intakeAssignmentAlignsWorkOrder(
  workOrder: ExecutorWorkOrder,
  intake: ExecutorIntakeContract,
  assignment: ExecutionAssignment
): boolean {
  return (
    workOrder.intakeId === intake.intakeId &&
    workOrder.assignmentId === assignment.assignmentId &&
    workOrder.sessionId === intake.sessionId &&
    workOrder.snapshotId === intake.snapshotId &&
    intake.assignmentId === assignment.assignmentId &&
    workOrder.executorType === intake.executorType &&
    workOrder.executorType === assignment.executorType
  );
}

export function createExecutionBridgePayload(input: {
  handoffRecord: BusinessLaunchHandoffRecord;
  intent: BusinessLaunchIntent;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder;
  intake: ExecutorIntakeContract;
  assignment: ExecutionAssignment;
  sessionId: string;
}): ExecutionBridgePayload {
  if (!intakeAssignmentAlignsWorkOrder(input.workOrder, input.intake, input.assignment)) {
    throw new Error("createExecutionBridgePayload: intake and assignment must match the current work order");
  }
  if (!isBusinessLaunchHandoffRecordCurrent({
    record: input.handoffRecord,
    intent: input.intent,
    readiness: input.readiness,
    workOrder: input.workOrder,
    sessionId: input.sessionId,
  })) {
    throw new Error("createExecutionBridgePayload: launch handoff record is not current");
  }
  if (input.workOrder.workOrderId !== input.handoffRecord.workOrderId) {
    throw new Error("createExecutionBridgePayload: work order does not match handoff record");
  }
  return {
    bridgeId: nextBridgeId(),
    handoffRecordId: input.handoffRecord.handoffRecordId,
    intentId: input.handoffRecord.intentId,
    workOrderId: input.workOrder.workOrderId,
    requirementId: input.handoffRecord.requirementId,
    sessionId: input.handoffRecord.sessionId,
    snapshotId: input.handoffRecord.snapshotId,
    executorType: input.workOrder.executorType,
    candidateTaskIds: [...input.workOrder.candidateTaskIds],
    candidateTasks: input.workOrder.candidateTasks,
    executionContext: buildExecutionContext({
      workOrder: input.workOrder,
      intake: input.intake,
      assignment: input.assignment,
    }),
    createdAtIso: new Date().toISOString(),
    status: "bridge_ready",
    source: "business_execution_bridge",
  };
}

export function isExecutionBridgePayloadCurrent(input: {
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.bridge || !input.handoffRecord || !input.sessionId) return false;
  if (
    !isBusinessLaunchHandoffRecordCurrent({
      record: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    return false;
  }
  return (
    input.bridge.status === "bridge_ready" &&
    input.bridge.source === "business_execution_bridge" &&
    input.bridge.handoffRecordId === input.handoffRecord.handoffRecordId &&
    input.bridge.intentId === input.intent?.intentId &&
    input.bridge.workOrderId === input.workOrder?.workOrderId &&
    input.bridge.sessionId === input.sessionId &&
    input.bridge.snapshotId === input.workOrder?.snapshotId &&
    input.bridge.executorType === input.workOrder?.executorType
  );
}
