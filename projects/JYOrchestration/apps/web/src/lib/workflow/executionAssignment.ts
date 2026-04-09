/**
 * Executor assignment for a business execution package (NOT Stage1/Stage2, NOT launch).
 */

import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";

export type ExecutionExecutorType = "cursor_executor" | "reviewer" | "scm" | "security" | "unassigned";

export const EXECUTION_EXECUTOR_TYPES: readonly ExecutionExecutorType[] = [
  "cursor_executor",
  "reviewer",
  "scm",
  "security",
  "unassigned",
] as const;

export const EXECUTOR_TYPE_LABELS: Record<ExecutionExecutorType, string> = {
  cursor_executor: "Cursor Executor",
  reviewer: "Reviewer",
  scm: "SCM",
  security: "Security",
  unassigned: "Unassigned",
};

export type ExecutionAssignment = {
  assignmentId: string;
  packageId: string;
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  executorType: ExecutionExecutorType;
  assignedAtIso: string;
  status: "assigned";
  assignedBy?: "user" | "local";
  note?: string;
};

function assignmentId(): string {
  return `execasg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function assignBusinessExecutionPackage(input: {
  pkg: BusinessExecutionPackage;
  executorType: ExecutionExecutorType;
  assignedBy?: "user" | "local";
  note?: string;
}): ExecutionAssignment {
  if (input.pkg.status !== "packaged" || input.pkg.source !== "business_execution_package") {
    throw new Error("assignBusinessExecutionPackage: package is not a valid business execution package");
  }
  return {
    assignmentId: assignmentId(),
    packageId: input.pkg.packageId,
    requestId: input.pkg.requestId,
    requirementId: input.pkg.requirementId,
    sessionId: input.pkg.sessionId,
    executorType: input.executorType,
    assignedAtIso: new Date().toISOString(),
    status: "assigned",
    assignedBy: input.assignedBy,
    note: input.note,
  };
}

export function isExecutionAssignmentForPackage(
  assignment: ExecutionAssignment | undefined,
  pkg: BusinessExecutionPackage | undefined
): boolean {
  if (!assignment || !pkg) return false;
  return (
    assignment.status === "assigned" &&
    assignment.packageId === pkg.packageId &&
    assignment.requestId === pkg.requestId &&
    assignment.sessionId === pkg.sessionId
  );
}
