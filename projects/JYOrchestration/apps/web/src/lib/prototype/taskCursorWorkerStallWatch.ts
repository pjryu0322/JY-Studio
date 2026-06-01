import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { isActiveTaskCursorJobStatus } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

/** Warn when server worker polling shows no job progress for this long. */
export const TASK_CURSOR_SERVER_WORKER_STALL_WARN_MS = 120_000;

export type TaskCursorWorkerStallWarning = Readonly<{
  readonly kind: "server_worker_stalled";
  readonly taskId: string;
  readonly elapsedMs: number;
  readonly pollCount: number;
  readonly message: string;
  readonly hint: string;
}>;

export function evaluateTaskCursorWorkerStallWarning(input: {
  readonly serverPolling?: boolean;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly activeJob?: TaskCursorJobSummary | null;
  readonly nowMs?: number;
}): TaskCursorWorkerStallWarning | null {
  const serverPolling = input.serverPolling ?? isServerTaskCursorPolling();
  if (!serverPolling) return null;

  const execution = input.execution ?? null;
  const activeJob = input.activeJob ?? null;
  const inFlightExecution = execution && isInFlightTaskCursorExecution(execution);
  const inFlightJob =
    activeJob &&
    isActiveTaskCursorJobStatus(activeJob.status) &&
    !activeJob.completedAt;
  if (!inFlightExecution && !inFlightJob) return null;

  const taskId = String(activeJob?.taskId ?? execution?.taskId ?? "").trim();
  if (!taskId) return null;

  const nowMs = input.nowMs ?? Date.now();
  const runningSinceMs = Math.max(
    parseIsoMs(execution?.updatedAt ?? execution?.createdAt),
    parseIsoMs(activeJob?.lastPollAt),
    parseIsoMs(activeJob?.nextPollAt),
  );
  if (!runningSinceMs) return null;

  const elapsedMs = Math.max(0, nowMs - runningSinceMs);
  if (elapsedMs < TASK_CURSOR_SERVER_WORKER_STALL_WARN_MS) return null;

  const pollCount = activeJob?.pollCount ?? 0;
  if (pollCount > 0) return null;

  const elapsedMin = Math.max(1, Math.round(elapsedMs / 60_000));
  return {
    kind: "server_worker_stalled",
    taskId,
    elapsedMs,
    pollCount,
    message: `${taskId} · 서버 Worker가 ${elapsedMin}분 이상 진행하지 않습니다 (pollCount=0).`,
    hint: "로컬에서는 apps/web에서 node scripts/run-task-cursor-worker.mjs 를 실행하거나, TASK_CURSOR_POLLING_MODE=client 로 전환해 주세요.",
  };
}

function parseIsoMs(iso: string | null | undefined): number {
  const raw = String(iso ?? "").trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}
