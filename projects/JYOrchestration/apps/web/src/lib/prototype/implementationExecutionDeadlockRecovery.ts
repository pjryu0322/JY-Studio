import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  getCurrentCodeTaskRunForQueue,
  parseCodeTaskExecutionRunsV1,
  updateCodeTaskExecutionRun,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import { isSelectedCodeTaskRunInFlight } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import {
  isInFlightTaskCursorExecution,
  isStaleAbandonedTaskCursorExecution,
  releaseAllInFlightTaskCursorPollingFromRequirementsState,
} from "@/lib/prototype/taskCursorClientPollLoop";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { parseTaskCursorExecutionV1, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const IMPLEMENTATION_EXECUTION_STALE_MINUTES = 30 as const;
export const EXECUTION_STALE_FAILURE_REASON = "execution_stale" as const;
export const EXECUTION_FORCE_RELEASE_FAILURE_REASON = "admin_force_release" as const;

export const EXECUTION_STALE_USER_MESSAGE =
  "30분 이상 진행이 없어 실행을 만료(STALE) 처리했습니다. [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

export const EXECUTION_FORCE_RELEASE_USER_MESSAGE =
  "실행 잠금을 해제했습니다. 환경을 확인한 뒤 [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

export type ImplementationExecutionDeadlockIssue =
  | "stale_task_cursor"
  | "stale_code_task_run"
  | "stale_quick_run"
  | "in_flight_without_run"
  | "force_release";

export type ImplementationExecutionDeadlockRecoveryResult = Readonly<{
  readonly issues: readonly ImplementationExecutionDeadlockIssue[];
  readonly patch: Record<string, unknown> | null;
  readonly userMessage: string | null;
}>;

function isTimestampStale(
  iso: string | undefined,
  thresholdMinutes: number,
  nowMs: number,
): boolean {
  const raw = String(iso ?? "").trim();
  if (!raw) return false;
  const ms = nowMs - Date.parse(raw);
  if (!Number.isFinite(ms) || ms < 0) return false;
  return Math.floor(ms / 60_000) >= thresholdMinutes;
}

function markTaskCursorStopped(
  execution: TaskCursorExecutionV1,
  nowIso: string,
  errorMessage: string,
): TaskCursorExecutionV1 {
  return {
    ...execution,
    status: "status_check_stopped",
    failureReason: "poll_timeout",
    errorMessage,
    updatedAt: nowIso,
  };
}

function resolveQueueRedispatch(input: {
  readonly queue: CodeTaskExecutionQueueV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): CodeTaskQueueDispatchRef | null {
  const codeTaskId = getCurrentQueueCodeTaskId(input.queue);
  if (!codeTaskId) return null;
  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  if (!run || run.status !== "queued" || isSelectedCodeTaskRunInFlight(run)) return null;
  const target = resolveCodeTaskDispatchTarget({
    codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!target) return null;
  return {
    codeTaskId: target.codeTask.codeTaskId,
    parentTaskId: target.parentTaskId,
    workItemId: target.workItem.id,
  };
}

/** persisted requirementsStateJson 기준 교착·STALE 진단 및 복구 패치 */
export function recoverImplementationExecutionDeadlock(input: {
  readonly rawRequirementsState: Record<string, unknown>;
  readonly nowIso?: string;
  readonly forceRelease?: boolean;
  readonly staleMinutes?: number;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): ImplementationExecutionDeadlockRecoveryResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const staleMinutes = input.staleMinutes ?? IMPLEMENTATION_EXECUTION_STALE_MINUTES;
  const issues: ImplementationExecutionDeadlockIssue[] = [];
  let next: Record<string, unknown> = { ...input.rawRequirementsState };

  if (input.forceRelease) {
    issues.push("force_release");
    const released = releaseAllInFlightTaskCursorPollingFromRequirementsState(next, nowIso);
    next = released.next;
    let runs = parseCodeTaskExecutionRunsV1(next.codeTaskExecutionRunsV1) ?? [];
    for (const run of runs) {
      if (!isInFlightCodeTaskExecutionRunStatus(run.status)) continue;
      runs = updateCodeTaskExecutionRun(runs, run.runId, {
        status: "status_check_stopped",
        failureReason: EXECUTION_FORCE_RELEASE_FAILURE_REASON,
        errorMessage: EXECUTION_FORCE_RELEASE_USER_MESSAGE,
        updatedAt: nowIso,
        completedAt: nowIso,
      });
    }
    if (runs.length) next = { ...next, codeTaskExecutionRunsV1: runs };
    const queue = parseCodeTaskExecutionQueueV1(next.codeTaskExecutionQueueV1);
    if (queue?.status === "running") {
      next = {
        ...next,
        codeTaskExecutionQueueV1: { ...queue, status: "paused", updatedAt: nowIso },
      };
    }
    const quickRun = parseImplementationQuickRunV1(next.implementationQuickRunV1);
    if (quickRun?.status === "running") {
      next = {
        ...next,
        implementationQuickRunV1: {
          ...quickRun,
          status: "paused",
          updatedAt: nowIso,
          blockedReason: "관리자 실행 잠금 해제",
        },
      };
    }
    return {
      issues,
      patch: next,
      userMessage: EXECUTION_FORCE_RELEASE_USER_MESSAGE,
      queueRedispatch: null,
    };
  }

  let runs = parseCodeTaskExecutionRunsV1(next.codeTaskExecutionRunsV1) ?? [];
  const queue = parseCodeTaskExecutionQueueV1(next.codeTaskExecutionQueueV1);
  let execution = parseTaskCursorExecutionV1(next.taskCursorExecutionV1);
  const quickRun = parseImplementationQuickRunV1(next.implementationQuickRunV1);

  if (execution && isInFlightTaskCursorExecution(execution)) {
    const abandoned = isStaleAbandonedTaskCursorExecution(execution, { staleMinutes });
    const timedOut = isTimestampStale(
      execution.updatedAt ?? execution.createdAt,
      staleMinutes,
      nowMs,
    );
    if (abandoned || timedOut) {
      issues.push("stale_task_cursor");
      execution = markTaskCursorStopped(execution, nowIso, EXECUTION_STALE_USER_MESSAGE);
      next = { ...next, taskCursorExecutionV1: execution };
      const queueRun = getCurrentCodeTaskRunForQueue(queue, runs);
      if (queueRun) {
        runs = syncCodeTaskExecutionRunsFromTaskCursor({
          runs,
          execution,
          codeTaskId: queueRun.codeTaskId,
          workItemId: queueRun.workItemId,
          nowIso,
        });
      }
    }
  }

  if (execution && isInFlightTaskCursorExecution(execution)) {
    const queueRun = getCurrentCodeTaskRunForQueue(queue, runs);
    if (!queueRun) {
      issues.push("in_flight_without_run");
      execution = markTaskCursorStopped(
        execution,
        nowIso,
        "Cursor 실행 기록이 없어 상태 확인을 중단했습니다.",
      );
      next = { ...next, taskCursorExecutionV1: execution };
    }
  }

  for (const run of runs) {
    if (run.status === "queued") continue;
    if (!isSelectedCodeTaskRunInFlight(run)) continue;
    if (!isTimestampStale(run.updatedAt ?? run.startedAt ?? run.createdAt, staleMinutes, nowMs)) {
      continue;
    }
    issues.push("stale_code_task_run");
    runs = updateCodeTaskExecutionRun(runs, run.runId, {
      status: "status_check_stopped",
      failureReason: EXECUTION_STALE_FAILURE_REASON,
      errorMessage: EXECUTION_STALE_USER_MESSAGE,
      updatedAt: nowIso,
      completedAt: nowIso,
    });
  }

  if (quickRun?.status === "running") {
    const anchor = quickRun.startedAt ?? quickRun.updatedAt;
    if (isTimestampStale(anchor, staleMinutes, nowMs)) {
      issues.push("stale_quick_run");
      next = {
        ...next,
        implementationQuickRunV1: {
          ...quickRun,
          status: "paused",
          updatedAt: nowIso,
          blockedReason: EXECUTION_STALE_USER_MESSAGE,
        },
      };
    }
  }

  if (runs.length) {
    next = { ...next, codeTaskExecutionRunsV1: runs };
  }

  return {
    issues,
    patch: issues.length ? next : null,
    userMessage: issues.some((issue) => issue.startsWith("stale"))
      ? EXECUTION_STALE_USER_MESSAGE
      : null,
  };
}
