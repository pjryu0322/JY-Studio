/**
 * Pipeline execution job payload (ExecutionJob.type = "pipeline").
 */

export type PipelineExecutionJobPayload = {
  readonly execRunId: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly actorUserId: string;
  readonly singleTaskId?: string;
  readonly resumeScmAfterApproval?: boolean;
};

export type PipelineExecutionJobResult = {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly reviewerVerdict?: string;
  readonly merged?: boolean;
};

export function parsePipelineExecutionJobPayload(payload: unknown): PipelineExecutionJobPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const execRunId = typeof p.execRunId === "string" ? p.execRunId.trim() : "";
  const taskId = typeof p.taskId === "string" ? p.taskId.trim() : "";
  const projectId = typeof p.projectId === "string" ? p.projectId.trim() : "";
  const actorUserId = typeof p.actorUserId === "string" ? p.actorUserId.trim() : "";
  if (!execRunId || !taskId || !projectId || !actorUserId) return null;
  return {
    execRunId,
    taskId,
    projectId,
    actorUserId,
    singleTaskId: typeof p.singleTaskId === "string" ? p.singleTaskId : undefined,
    resumeScmAfterApproval: p.resumeScmAfterApproval === true,
  };
}
