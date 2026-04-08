import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";

export type ExecutionLaunchSnapshot = {
  snapshotId: string;
  sessionId: string;
  requirementId: string | null;
  confirmedTaskIds: string[];
  readyTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  summary: {
    confirmedCount: number;
    readyCount: number;
    candidateCount: number;
  };
  preparedAtIso: string;
};

function snapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createExecutionLaunchSnapshot(input: {
  sessionId: string;
  requirementId: string | null;
  confirmedTasks: CollaborationOfficialTaskDraft[];
  candidateTasks: CollaborationOfficialTaskDraft[];
}): ExecutionLaunchSnapshot {
  const confirmedTaskIds = input.confirmedTasks.map((t) => t.id);
  const readyTaskIds = input.candidateTasks.map((t) => t.id);
  return {
    snapshotId: snapshotId(),
    sessionId: input.sessionId,
    requirementId: input.requirementId,
    confirmedTaskIds,
    readyTaskIds,
    candidateTasks: input.candidateTasks,
    summary: {
      confirmedCount: input.confirmedTasks.length,
      readyCount: readyTaskIds.length,
      candidateCount: input.candidateTasks.length,
    },
    preparedAtIso: new Date().toISOString(),
  };
}

