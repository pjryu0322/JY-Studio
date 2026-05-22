/**
 * Cursor execution job payload (ExecutionJob.type = "cursor").
 */

import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";

export type CursorChainSource = "normal" | "self-healing" | "background";

export type CursorExecutionJobPayload = {
  readonly execRunId: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly actorUserId: string;
  readonly singleTaskId?: string;
  /** When true, sync orchestrator runs reflection/pipeline — handler skips chain. */
  readonly syncDispatch?: boolean;
  readonly chainSource?: CursorChainSource;
  readonly selfHealingFromExecRunId?: string;
};

export type CursorExecutionJobResult = {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly cursorOutcome?: ExecuteCursorRunOutcome;
  readonly pipelineChain?: {
    readonly chained: boolean;
    readonly reason?: string;
    readonly pipelineJobId?: string;
  };
};

export function parseCursorExecutionJobPayload(payload: unknown): CursorExecutionJobPayload | null {
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
    syncDispatch: p.syncDispatch === true,
    chainSource:
      p.chainSource === "normal" || p.chainSource === "self-healing" || p.chainSource === "background"
        ? p.chainSource
        : undefined,
    selfHealingFromExecRunId:
      typeof p.selfHealingFromExecRunId === "string" ? p.selfHealingFromExecRunId : undefined,
  };
}
