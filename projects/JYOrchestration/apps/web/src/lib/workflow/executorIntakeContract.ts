/**
 * Executor-facing intake contract derived from handoff (NOT Stage1/Stage2, NOT launch).
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";

export type ExecutorIntakeShapedPayload =
  | { executorType: "cursor_executor"; workType: "implementation"; targetScopeSummary: string }
  | { executorType: "reviewer"; workType: "review"; reviewFocusSummary: string }
  | { executorType: "scm"; workType: "scm"; scmFocusSummary: string }
  | { executorType: "security"; workType: "security"; securityFocusSummary: string }
  | { executorType: "unassigned"; workType: "unassigned"; routingSummary: string };

export type ExecutorIntakeContract = {
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
  createdAtIso: string;
  status: "intake_ready";
  source: "executor_intake_contract";
  summary?: string;
  note?: string;
  shaped: ExecutorIntakeShapedPayload;
};

function intakeId(): string {
  return `execint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function baseContextSummary(handoff: ExecutionAssignmentHandoffPayload): string {
  const n = handoff.candidateTaskIds.length;
  const req = handoff.requirementId ? `requirement ${handoff.requirementId}` : "no requirement id";
  return `${n} candidate task(s), ${req}, snapshot ${handoff.snapshotId}`;
}

/** Lightweight executor-specific hints derived from the handoff (no external I/O). */
export function shapeExecutorIntakePayload(handoff: ExecutionAssignmentHandoffPayload): ExecutorIntakeShapedPayload {
  const ctx = baseContextSummary(handoff);
  switch (handoff.executorType) {
    case "cursor_executor":
      return {
        executorType: "cursor_executor",
        workType: "implementation",
        targetScopeSummary: `Implementation scope: ${ctx}`,
      };
    case "reviewer":
      return {
        executorType: "reviewer",
        workType: "review",
        reviewFocusSummary: `Review focus: ${ctx}`,
      };
    case "scm":
      return {
        executorType: "scm",
        workType: "scm",
        scmFocusSummary: `SCM / change-management focus: ${ctx}`,
      };
    case "security":
      return {
        executorType: "security",
        workType: "security",
        securityFocusSummary: `Security review focus: ${ctx}`,
      };
    case "unassigned":
      return {
        executorType: "unassigned",
        workType: "unassigned",
        routingSummary: `Routing TBD: ${ctx}`,
      };
  }
}

export function createExecutorIntakeContract(input: {
  handoff: ExecutionAssignmentHandoffPayload;
  summary?: string;
  note?: string;
}): ExecutorIntakeContract {
  if (input.handoff.status !== "handoff_ready" || input.handoff.source !== "execution_assignment_handoff") {
    throw new Error("createExecutorIntakeContract: handoff is not a valid assignment handoff payload");
  }
  const shaped = shapeExecutorIntakePayload(input.handoff);
  return {
    intakeId: intakeId(),
    handoffId: input.handoff.handoffId,
    assignmentId: input.handoff.assignmentId,
    packageId: input.handoff.packageId,
    requestId: input.handoff.requestId,
    requirementId: input.handoff.requirementId,
    sessionId: input.handoff.sessionId,
    snapshotId: input.handoff.snapshotId,
    executorType: input.handoff.executorType,
    candidateTaskIds: [...input.handoff.candidateTaskIds],
    candidateTasks: input.handoff.candidateTasks.map((t) => ({ ...t })),
    createdAtIso: new Date().toISOString(),
    status: "intake_ready",
    source: "executor_intake_contract",
    summary: input.summary,
    note: input.note,
    shaped,
  };
}

export function isExecutorIntakeContractForHandoff(
  intake: ExecutorIntakeContract | undefined,
  handoff: ExecutionAssignmentHandoffPayload | undefined
): boolean {
  if (!intake || !handoff) return false;
  return (
    intake.status === "intake_ready" &&
    intake.source === "executor_intake_contract" &&
    intake.handoffId === handoff.handoffId &&
    intake.assignmentId === handoff.assignmentId &&
    intake.packageId === handoff.packageId &&
    intake.requestId === handoff.requestId &&
    intake.sessionId === handoff.sessionId
  );
}

/** One-line preview for compact UI (workType + primary hint). */
export function executorIntakePreviewLine(contract: ExecutorIntakeContract): string {
  const s = contract.shaped;
  switch (s.executorType) {
    case "cursor_executor":
      return `${s.workType}: ${s.targetScopeSummary}`;
    case "reviewer":
      return `${s.workType}: ${s.reviewFocusSummary}`;
    case "scm":
      return `${s.workType}: ${s.scmFocusSummary}`;
    case "security":
      return `${s.workType}: ${s.securityFocusSummary}`;
    case "unassigned":
    default:
      return `${s.workType}: ${s.routingSummary}`;
  }
}
