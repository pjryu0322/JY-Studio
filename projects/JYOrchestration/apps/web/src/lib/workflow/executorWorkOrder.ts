/**
 * Executor work order derived from intake (NOT Stage1/Stage2, NOT launch).
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";

export type ExecutorWorkOrder = {
  workOrderId: string;
  intakeId: string;
  handoffId: string;
  assignmentId: string;
  packageId: string;
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  executorType: ExecutionExecutorType;
  candidateTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  title: string;
  objective: string;
  workInstructions: string;
  successCriteria: string;
  createdAtIso: string;
  status: "prepared";
  source: "executor_work_order";
  summary?: string;
  note?: string;
  workOrderLabel?: string;
};

export type ExecutorWorkOrderShapedFields = {
  title: string;
  objective: string;
  workInstructions: string;
  successCriteria: string;
};

function workOrderId(): string {
  return `execwo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function taskContextLine(intake: ExecutorIntakeContract): string {
  const n = intake.candidateTaskIds.length;
  return `${n} candidate task(s), snapshot ${intake.snapshotId}`;
}

/** Lightweight executor-specific objectives and instructions (no external I/O). */
export function shapeExecutorWorkOrder(intake: ExecutorIntakeContract): ExecutorWorkOrderShapedFields {
  const ctx = taskContextLine(intake);
  switch (intake.executorType) {
    case "cursor_executor":
      return {
        title: "Implementation work order",
        objective: `Implement the agreed work package (${ctx}). Deliver code changes aligned with the intake scope.`,
        workInstructions: `Work from the candidate task list and descriptions. Target scope reflects snapshot ${intake.snapshotId}. Implement, integrate, and keep changes scoped to this work order.`,
        successCriteria: `Implementation package complete: candidate tasks addressed, behavior matches descriptions, and output is ready for downstream review.`,
      };
    case "reviewer":
      return {
        title: "Review work order",
        objective: `Perform a structured review of the proposed execution package (${ctx}).`,
        workInstructions: `Review candidate tasks for clarity, risk, and fit. Record findings and required changes without starting implementation.`,
        successCriteria: `Review complete: feedback captured and review scope closed for this intake.`,
      };
    case "scm":
      return {
        title: "SCM work order",
        objective: `Prepare SCM / change-management handling for this package (${ctx}).`,
        workInstructions: `Assess branch strategy, packaging, and merge readiness hints for the snapshot and tasks. No production merge implied here.`,
        successCriteria: `SCM readiness notes complete: branching/packaging expectations documented for handoff.`,
      };
    case "security":
      return {
        title: "Security validation work order",
        objective: `Validate security posture for the execution package (${ctx}).`,
        workInstructions: `Review tasks and scope for security concerns, data handling, and dependency risk. Document required mitigations.`,
        successCriteria: `Security validation complete: concerns triaged and criteria recorded for this work order.`,
      };
    case "unassigned":
      return {
        title: "Routing work order",
        objective: `Route this package to the correct executor (${ctx}).`,
        workInstructions: `Intake is unassigned; determine owner and re-issue assignment before execution.`,
        successCriteria: `Routing decision recorded and superseded by a concrete executor assignment.`,
      };
  }
}

export function createExecutorWorkOrder(input: {
  intake: ExecutorIntakeContract;
  summary?: string;
  note?: string;
  workOrderLabel?: string;
}): ExecutorWorkOrder {
  if (input.intake.status !== "intake_ready" || input.intake.source !== "executor_intake_contract") {
    throw new Error("createExecutorWorkOrder: intake is not a valid executor intake contract");
  }
  const shaped = shapeExecutorWorkOrder(input.intake);
  return {
    workOrderId: workOrderId(),
    intakeId: input.intake.intakeId,
    handoffId: input.intake.handoffId,
    assignmentId: input.intake.assignmentId,
    packageId: input.intake.packageId,
    requestId: input.intake.requestId,
    requirementId: input.intake.requirementId,
    sessionId: input.intake.sessionId,
    snapshotId: input.intake.snapshotId,
    executorType: input.intake.executorType,
    candidateTaskIds: [...input.intake.candidateTaskIds],
    candidateTasks: input.intake.candidateTasks.map((t) => ({ ...t })),
    title: shaped.title,
    objective: shaped.objective,
    workInstructions: shaped.workInstructions,
    successCriteria: shaped.successCriteria,
    createdAtIso: new Date().toISOString(),
    status: "prepared",
    source: "executor_work_order",
    summary: input.summary,
    note: input.note,
    workOrderLabel: input.workOrderLabel,
  };
}

export function isExecutorWorkOrderForIntake(
  workOrder: ExecutorWorkOrder | undefined,
  intake: ExecutorIntakeContract | undefined
): boolean {
  if (!workOrder || !intake) return false;
  return (
    workOrder.status === "prepared" &&
    workOrder.source === "executor_work_order" &&
    workOrder.intakeId === intake.intakeId &&
    workOrder.handoffId === intake.handoffId &&
    workOrder.assignmentId === intake.assignmentId &&
    workOrder.packageId === intake.packageId &&
    workOrder.requestId === intake.requestId &&
    workOrder.sessionId === intake.sessionId
  );
}

export function truncateWorkOrderPreview(text: string, maxLen = 100): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}
