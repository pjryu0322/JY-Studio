export function serializeAiMemberActionRow(row: {
  id: string;
  projectId: string;
  taskId: string | null;
  taskPromptId: string | null;
  taskRunId: string | null;
  gitChangeRequestId: string | null;
  projectMemberId: string;
  actionType: string;
  status: string;
  requestPayload: unknown;
  resultPayload: unknown;
  requestedByUserId: string;
  requestedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  lastError?: string | null;
  executionMode: string;
  providerKey?: string | null;
  assignedExecutor?: string | null;
  retryCount?: number;
  availableAt?: Date | null;
  consumedBy?: string | null;
  correlationKey?: string | null;
  reviewStatus?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: Date | null;
  reviewComment?: string | null;
  approvedPayload?: unknown;
  applyStatus?: string;
  appliedAt?: Date | null;
  appliedByUserId?: string | null;
  updatedAt: Date;
  projectMember: {
    id: string;
    displayName: string | null;
    memberType: string;
    role: string;
    aiProvider: string | null;
  };
}) {
  const rp = row.resultPayload;
  let summaryPreview: string | null = null;
  if (rp && typeof rp === "object" && !Array.isArray(rp)) {
    const o = rp as Record<string, unknown>;
    if (typeof o.summaryText === "string") summaryPreview = o.summaryText.slice(0, 240);
    else if (typeof o.message === "string") summaryPreview = String(o.message).slice(0, 240);
  }

  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    projectMemberId: row.projectMemberId,
    actionType: row.actionType,
    status: row.status,
    requestPayload: row.requestPayload,
    resultPayload: row.resultPayload,
    summaryPreview,
    requestedByUserId: row.requestedByUserId,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    lastError: row.lastError ?? null,
    executionMode: row.executionMode,
    providerKey: row.providerKey ?? null,
    assignedExecutor: row.assignedExecutor ?? null,
    retryCount: row.retryCount ?? 0,
    availableAt: row.availableAt?.toISOString() ?? null,
    consumedBy: row.consumedBy ?? null,
    correlationKey: row.correlationKey ?? null,
    reviewStatus: row.reviewStatus ?? null,
    reviewedByUserId: row.reviewedByUserId ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewComment: row.reviewComment ? row.reviewComment.slice(0, 2000) : null,
    approvedPayload: row.approvedPayload ?? null,
    applyStatus: row.applyStatus ?? "NOT_APPLIED",
    appliedAt: row.appliedAt?.toISOString() ?? null,
    appliedByUserId: row.appliedByUserId ?? null,
    updatedAt: row.updatedAt.toISOString(),
    targetMember: {
      id: row.projectMember.id,
      displayName: row.projectMember.displayName,
      memberType: row.projectMember.memberType,
      role: row.projectMember.role,
      aiProvider: row.projectMember.aiProvider,
    },
  };
}

export function serializeAiMemberActionReviewLogEntry(log: {
  id: string;
  actionId: string;
  reviewerUserId: string;
  decision: string;
  comment: string | null;
  createdAt: Date;
  reviewer: { id: string; name: string; email: string };
}) {
  return {
    id: log.id,
    actionId: log.actionId,
    reviewerUserId: log.reviewerUserId,
    reviewerName: log.reviewer.name,
    reviewerEmail: log.reviewer.email,
    decision: log.decision,
    comment: log.comment,
    createdAt: log.createdAt.toISOString(),
  };
}
