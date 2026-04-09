import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export type BusinessExecutionRequest = {
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  candidateTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  createdAtIso: string;
  status: "requested";
  source: "business_pre_execution";
  summary?: {
    candidateCount: number;
  };
  note?: string;
  requestLabel?: string;
};

function requestId(): string {
  return `bizreq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBusinessExecutionRequest(input: {
  snapshot: ExecutionLaunchSnapshot;
  note?: string;
  requestLabel?: string;
}): BusinessExecutionRequest {
  const candidateTaskIds = input.snapshot.readyTaskIds;
  return {
    requestId: requestId(),
    requirementId: input.snapshot.requirementId,
    sessionId: input.snapshot.sessionId,
    snapshotId: input.snapshot.snapshotId,
    candidateTaskIds,
    candidateTasks: input.snapshot.candidateTasks,
    createdAtIso: new Date().toISOString(),
    status: "requested",
    source: "business_pre_execution",
    summary: { candidateCount: candidateTaskIds.length },
    note: input.note,
    requestLabel: input.requestLabel,
  };
}

