import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  isCursorCloudAgentRunId,
  parseTaskCursorExecutionV1,
  TASK_CURSOR_POLL_CANCELLED_MESSAGE,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import { isMissingCursorAgentIdDuringLaunchGrace } from "@/lib/runtime/implementationRuntime/implementationRuntimeLaunchGrace";

const IN_FLIGHT_TASK_CURSOR_STATUSES = new Set([
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

export function isInFlightTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  return IN_FLIGHT_TASK_CURSOR_STATUSES.has(execution.status);
}

/** persisted requirementsStateJson에서 in-flight Cursor 폴링을 모두 해제한다. */
export function releaseAllInFlightTaskCursorPollingFromRequirementsState(
  raw: unknown,
  nowIso?: string,
): { readonly next: Record<string, unknown>; readonly releasedTaskIds: readonly string[] } {
  const now = nowIso ?? new Date().toISOString();
  if (!raw || typeof raw !== "object") {
    return { next: {}, releasedTaskIds: [] };
  }
  const source = raw as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  const releasedTaskIds: string[] = [];

  const execution = parseTaskCursorExecutionV1(source.taskCursorExecutionV1);
  if (execution && isInFlightTaskCursorExecution(execution)) {
    releasedTaskIds.push(execution.taskId);
    next.taskCursorExecutionV1 = {
      ...execution,
      status: "status_check_stopped",
      errorMessage: TASK_CURSOR_POLL_CANCELLED_MESSAGE,
      updatedAt: now,
    };
  }

  const quickRunRaw = source.implementationQuickRunV1;
  if (quickRunRaw && typeof quickRunRaw === "object") {
    const status = String((quickRunRaw as Record<string, unknown>).status ?? "").trim();
    if (status === "running") {
      next.implementationQuickRunV1 = {
        ...(quickRunRaw as Record<string, unknown>),
        status: "paused",
        updatedAt: now,
        blockedReason: "폴링 일괄 해제",
      };
    }
  }

  return { next, releasedTaskIds };
}

/** 폴링이 끊긴 채 persisted state만 in-flight로 남은 실행 */
export function isStaleAbandonedTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
  input?: {
    readonly developerStatus?: string | null;
    readonly staleMinutes?: number;
    readonly pollCount?: number;
    readonly serverPolling?: boolean;
    readonly nowMs?: number;
  },
): boolean {
  if (!execution || !isInFlightTaskCursorExecution(execution)) return false;
  if (input?.developerStatus === "failed") return true;
  if (isTaskCursorStatusCheckStopped(execution)) return true;
  if (
    isMissingCursorAgentIdDuringLaunchGrace({
      execution,
      pollCount: input?.pollCount,
      serverPolling: input?.serverPolling,
      nowMs: input?.nowMs,
    })
  ) {
    return false;
  }
  if (execution.status === "cursor_running" && !isCursorCloudAgentRunId(execution.cursorRunId)) {
    return true;
  }
  if (execution.status === "cursor_requested" && !String(execution.cursorRunId ?? "").trim()) {
    return true;
  }
  const staleMinutes = input?.staleMinutes;
  if (staleMinutes != null && staleMinutes > 0) {
    const elapsed = formatTaskCursorElapsedMinutes(
      execution.updatedAt ?? execution.createdAt,
    );
    if (elapsed != null && elapsed >= staleMinutes) return true;
  }
  return false;
}

/** 다른 Task 실행/재시작을 막아야 하는 실제 in-flight Cursor 실행 */
export function isActiveTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
  input?: { readonly developerStatus?: string | null },
): execution is TaskCursorExecutionV1 {
  if (!execution || !isInFlightTaskCursorExecution(execution)) return false;
  return !isStaleAbandonedTaskCursorExecution(execution, input);
}

export { TASK_CURSOR_POLL_CANCELLED_MESSAGE } from "@/lib/prototype/taskCursorExecution";

export function isTaskCursorStatusCheckStopped(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  if (execution.status === "status_check_stopped") return true;
  if (execution.failureReason === "poll_cancelled" && execution.status === "cursor_failed") {
    return true;
  }
  const message = String(execution.errorMessage ?? "").trim();
  return (
    message === TASK_CURSOR_POLL_CANCELLED_MESSAGE ||
    message.includes("상태 확인을 중단")
  );
}

/** @deprecated Use isTaskCursorStatusCheckStopped */
export function isTaskCursorPollCancelledExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  return isTaskCursorStatusCheckStopped(execution);
}

/** Cloud Agent runId가 있으면 플랫폼 상태 확인만 재개할 수 있다 (Cursor run 취소 API 없음). */
export function isTaskCursorStatusCheckResumable(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!isTaskCursorStatusCheckStopped(execution)) return false;
  return isCursorCloudAgentRunId(execution.cursorRunId);
}

/** Cloud Agent 폴링은 launch 응답의 `bc-<uuid>` runId가 있을 때만 시작한다. */
export function canPollTaskCursorCloudAgent(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  if (execution.status !== "cursor_running" && execution.status !== "github_verifying") {
    return false;
  }
  return isCursorCloudAgentRunId(execution.cursorRunId);
}

export function resolveTaskCursorPollWorkItems(
  execution: TaskCursorExecutionV1,
  allWorkItems: readonly CursorWorkItem[],
): readonly CursorWorkItem[] {
  if (execution.workItemIds.length > 0) {
    const idSet = new Set(execution.workItemIds);
    const byIds = allWorkItems.filter((item) => idSet.has(item.id));
    if (byIds.length) return byIds;
  }
  const byTask = allWorkItems.filter((item) => item.taskId === execution.taskId);
  return byTask.length ? byTask : allWorkItems;
}

export function formatTaskCursorElapsedMinutes(iso?: string | null): number | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const ms = Date.now() - Date.parse(raw);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}
