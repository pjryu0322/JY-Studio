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
