/**
 * Executor handoff payload after assignment (NOT Stage1/Stage2, NOT launch).
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import {
  isExecutionAssignmentForPackage,
  type ExecutionAssignment,
  type ExecutionExecutorType,
} from "@/lib/workflow/executionAssignment";

export type ExecutionAssignmentHandoffPayload = {
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
  status: "handoff_ready";
  source: "execution_assignment_handoff";
  summary?: string;
  handoffLabel?: string;
  note?: string;
};

function handoffId(): string {
  return `exechof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createExecutionAssignmentHandoff(input: {
  assignment: ExecutionAssignment;
  pkg: BusinessExecutionPackage;
  summary?: string;
  handoffLabel?: string;
  note?: string;
}): ExecutionAssignmentHandoffPayload {
  if (!isExecutionAssignmentForPackage(input.assignment, input.pkg)) {
    throw new Error("createExecutionAssignmentHandoff: assignment does not match the given package");
  }
  if (input.pkg.status !== "packaged" || input.pkg.source !== "business_execution_package") {
    throw new Error("createExecutionAssignmentHandoff: invalid business execution package");
  }
  return {
    handoffId: handoffId(),
    assignmentId: input.assignment.assignmentId,
    packageId: input.pkg.packageId,
    requestId: input.pkg.requestId,
    requirementId: input.pkg.requirementId,
    sessionId: input.pkg.sessionId,
    snapshotId: input.pkg.snapshotId,
    executorType: input.assignment.executorType,
    candidateTaskIds: [...input.pkg.candidateTaskIds],
    candidateTasks: input.pkg.candidateTasks.map((t) => ({ ...t })),
    createdAtIso: new Date().toISOString(),
    status: "handoff_ready",
    source: "execution_assignment_handoff",
    summary: input.summary,
    handoffLabel: input.handoffLabel,
    note: input.note,
  };
}

export function isExecutionAssignmentHandoffPayloadForAssignment(
  handoff: ExecutionAssignmentHandoffPayload | undefined,
  assignment: ExecutionAssignment | undefined,
  pkg: BusinessExecutionPackage | undefined
): boolean {
  if (!handoff || !assignment || !pkg) return false;
  return (
    handoff.status === "handoff_ready" &&
    handoff.source === "execution_assignment_handoff" &&
    handoff.assignmentId === assignment.assignmentId &&
    handoff.packageId === pkg.packageId &&
    handoff.requestId === assignment.requestId &&
    handoff.sessionId === assignment.sessionId
  );
}
