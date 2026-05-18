import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";

export type ExecutionLaunchInput = {
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
  createdAtIso: string;
};

export function buildExecutionLaunchInput(input: {
  sessionId: string;
  requirementId: string | null;
  confirmedTasks: CollaborationOfficialTaskDraft[];
  candidateTasks: CollaborationOfficialTaskDraft[];
}): ExecutionLaunchInput {
  const confirmedTaskIds = input.confirmedTasks.map((t) => t.id);
  const readyTaskIds = input.candidateTasks.map((t) => t.id);
  return {
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
    createdAtIso: new Date().toISOString(),
  };
}

