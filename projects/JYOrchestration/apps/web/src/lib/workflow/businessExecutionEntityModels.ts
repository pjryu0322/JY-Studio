/**
 * Persistence-oriented core entity shapes for Business Execution domain.
 *
 * These are intentionally clean and FK-like: ids, timestamps, references.
 * They exclude derived state (current/non-current, readiness, staleness, next-action).
 *
 * Implementation detail: current in-memory models already match most of these fields; these interfaces
 * exist to codify what we expect to persist later.
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";

export interface BusinessExecutionRequestEntity {
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  createdAtIso: string;
  status: "requested";
  source: "business_pre_execution";
  /** FK-like snapshot payload (kept small). */
  confirmedTaskIds: string[];
  candidateTaskIds: string[];
  /** Optional payload; may be persisted as JSON later. */
  candidateTasks?: CollaborationOfficialTaskDraft[];
  note?: string;
  requestLabel?: string;
}

export interface BusinessExecutionApprovalEntity {
  approvalId: string;
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  approvedAtIso: string;
  status: "approved";
  source: "business_execution_gate";
  approvedBy?: "user" | "local";
  note?: string;
}

export interface BusinessExecutionPackageEntity {
  packageId: string;
  requestId: string;
  approvalId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  createdAtIso: string;
  status: "packaged";
  source: "business_execution_package";
  candidateTaskIds: string[];
  /** Optional payload; may be persisted as JSON later. */
  candidateTasks?: CollaborationOfficialTaskDraft[];
  summary?: string;
  note?: string;
  packageLabel?: string;
}

export interface ExecutionAssignmentEntity {
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
}

export interface BusinessExecutionRunEntity {
  runId: string;
  launchCommandId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  startedAtIso: string;
  finishedAtIso?: string;
  status: "queued" | "running" | "completed" | "failed";
  source: "business_execution_run";
  summary?: string;
  errorMessage?: string;
  note?: string;
  /** Minimal monitoring fields (optional; still not derived currency). */
  latestMessage?: string;
  progressLabel?: string;
  updatedAtIso?: string;
}

