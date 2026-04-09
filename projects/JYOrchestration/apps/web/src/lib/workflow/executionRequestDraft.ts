import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export type ExecutionRequestDraft = {
  requestId: string;
  sessionId: string;
  requirementId: string | null;
  snapshotId: string;
  confirmedTaskIds: string[];
  readyTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  createdAtIso: string;
  source: "pre_execution";
  status: "draft";
  summary?: {
    confirmedCount: number;
    readyCount: number;
    candidateCount: number;
  };
  note?: string;
};

function requestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createExecutionRequestDraft(input: {
  snapshot: ExecutionLaunchSnapshot;
}): ExecutionRequestDraft {
  return {
    requestId: requestId(),
    sessionId: input.snapshot.sessionId,
    requirementId: input.snapshot.requirementId,
    snapshotId: input.snapshot.snapshotId,
    confirmedTaskIds: input.snapshot.confirmedTaskIds,
    readyTaskIds: input.snapshot.readyTaskIds,
    candidateTasks: input.snapshot.candidateTasks,
    createdAtIso: new Date().toISOString(),
    source: "pre_execution",
    status: "draft",
    summary: { ...input.snapshot.summary },
  };
}

