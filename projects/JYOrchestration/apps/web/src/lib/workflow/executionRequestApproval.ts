import type { ExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";

export type ExecutionRequestApproval = {
  approvalId: string;
  requestId: string;
  sessionId: string;
  requirementId: string | null;
  approvedAtIso: string;
  status: "approved";
  source: "pre_execution_gate";
  approvedBy?: "user" | "local";
  note?: string;
};

function approvalId(): string {
  return `appr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function approveExecutionRequestDraft(input: {
  draft: ExecutionRequestDraft;
  approvedBy?: "user" | "local";
  note?: string;
}): ExecutionRequestApproval {
  return {
    approvalId: approvalId(),
    requestId: input.draft.requestId,
    sessionId: input.draft.sessionId,
    requirementId: input.draft.requirementId,
    approvedAtIso: new Date().toISOString(),
    status: "approved",
    source: "pre_execution_gate",
    approvedBy: input.approvedBy,
    note: input.note,
  };
}

