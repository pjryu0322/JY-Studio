import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  updateCodeTaskExecutionRun,
} from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import { isRuntimeActiveCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import {
  EXECUTION_FORCE_RELEASE_FAILURE_REASON,
  EXECUTION_FORCE_RELEASE_USER_MESSAGE,
  EXECUTION_STALE_FAILURE_REASON,
  EXECUTION_STALE_USER_MESSAGE,
} from "@/lib/prototype/implementationExecutionDeadlockRecovery";
import {
  buildActiveDispatchFromRuntimeHead,
  deriveImplementationRuntimeFromRequirementsState,
  evaluateRuntimeRecovery,
  type ImplementationRuntimeActiveDispatchV1,
} from "@/lib/prototype/implementationRuntimeState";
import { mergeRequirementsStateWithRuntime } from "@/lib/prototype/implementationRuntimeSync";
import { buildPersistedActiveDispatchSnapshotPatch } from "@/lib/prototype/implementationRuntimePanelBridge";
import { stripLegacyImplementationRuntimeStateFromRecord } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
import {
  isInFlightTaskCursorExecution,
  releaseAllInFlightTaskCursorPollingFromRequirementsState,
} from "@/lib/prototype/taskCursorClientPollLoop";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type ImplementationRuntimeRecoveryResult = Readonly<{
  readonly patch: Record<string, unknown> | null;
  readonly userMessage: string | null;
  readonly redispatch: ImplementationRuntimeActiveDispatchV1 | null;
  readonly shouldWatchdogPoll: boolean;
  readonly issues: readonly string[];
}>;

function markTaskCursorStopped(
  execution: NonNullable<ReturnType<typeof parseTaskCursorExecutionV1>>,
  nowIso: string,
  errorMessage: string,
) {
  return {
    ...execution,
    status: "status_check_stopped" as const,
    failureReason: "poll_timeout" as const,
    errorMessage,
    updatedAt: nowIso,
  };
}

/** Runtime 기준 교착·STALE·orphan 복구 (persisted state only). */
export function recoverImplementationRuntimeState(input: {
  readonly rawRequirementsState: Record<string, unknown>;
  readonly projectId: string;
  readonly nowIso?: string;
  readonly forceRelease?: boolean;
  readonly pollCount?: number;
}): ImplementationRuntimeRecoveryResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  let next: Record<string, unknown> = { ...input.rawRequirementsState };

  if (input.forceRelease) {
    const released = releaseAllInFlightTaskCursorPollingFromRequirementsState(next, nowIso);
    next = released.next;
    let runs = parseCodeTaskExecutionRunsV1(next.codeTaskExecutionRunsV1) ?? [];
    for (const run of runs) {
      if (!isRuntimeActiveCodeTaskExecutionRunStatus(run.status) && run.status !== "queued") {
        continue;
      }
      runs = updateCodeTaskExecutionRun(runs, run.runId, {
        status: "status_check_stopped",
        failureReason: EXECUTION_FORCE_RELEASE_FAILURE_REASON,
        errorMessage: EXECUTION_FORCE_RELEASE_USER_MESSAGE,
        updatedAt: nowIso,
        completedAt: nowIso,
      });
    }
    if (runs.length) next = { ...next, codeTaskExecutionRunsV1: runs };
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
    next = stripLegacyImplementationRuntimeStateFromRecord(next);
    next = mergeRequirementsStateWithRuntime({
      projectId: input.projectId,
      state: next,
      nowIso,
    });
    return {
      patch: next,
      userMessage: EXECUTION_FORCE_RELEASE_USER_MESSAGE,
      redispatch: null,
      shouldWatchdogPoll: false,
      issues: ["force_release"],
    };
  }

  const runs = parseCodeTaskExecutionRunsV1(next.codeTaskExecutionRunsV1) ?? [];
  let execution = parseTaskCursorExecutionV1(next.taskCursorExecutionV1);
  const quickRun = parseImplementationQuickRunV1(next.implementationQuickRunV1);
  const runtime = deriveImplementationRuntimeFromRequirementsState({
    raw: next,
    projectId: input.projectId,
    nowIso,
  });
  const plan = evaluateRuntimeRecovery({
    runtime,
    runs,
    taskCursor: execution,
    quickRunRunning: quickRun?.status === "running",
    pollCount: input.pollCount ?? 0,
    nowIso,
  });

  if (!plan.issues.length) {
    return {
      patch: null,
      userMessage: null,
      redispatch: null,
      shouldWatchdogPoll: false,
      issues: [],
    };
  }

  const activeCodeTaskId =
    runtime.activeCodeTaskId?.trim() || runtime.activeDispatch?.codeTaskId?.trim() || "";
  const headRun = activeCodeTaskId ? findLatestRunForCodeTask(runs, activeCodeTaskId) : null;

  if (plan.markStale && execution && isInFlightTaskCursorExecution(execution)) {
    execution = markTaskCursorStopped(execution, nowIso, EXECUTION_STALE_USER_MESSAGE);
    next = { ...next, taskCursorExecutionV1: execution };
    let nextRuns = runs;
    if (headRun) {
      nextRuns = syncCodeTaskExecutionRunsFromTaskCursor({
        runs: nextRuns,
        execution,
        codeTaskId: headRun.codeTaskId,
        workItemId: headRun.workItemId,
        nowIso,
      });
    }
    if (headRun && isRuntimeActiveCodeTaskExecutionRunStatus(headRun.status)) {
      nextRuns = updateCodeTaskExecutionRun(nextRuns, headRun.runId, {
        status: "status_check_stopped",
        failureReason: EXECUTION_STALE_FAILURE_REASON,
        errorMessage: EXECUTION_STALE_USER_MESSAGE,
        updatedAt: nowIso,
        completedAt: nowIso,
      });
    }
    next = { ...next, codeTaskExecutionRunsV1: nextRuns };
  }

  if (plan.markFailed) {
    if (headRun && isRuntimeActiveCodeTaskExecutionRunStatus(headRun.status)) {
      const nextRuns = updateCodeTaskExecutionRun(runs, headRun.runId, {
        status: "failed",
        failureReason: "dispatch_timeout",
        errorMessage: "Cursor 디스패치가 완료되지 않았습니다.",
        updatedAt: nowIso,
        completedAt: nowIso,
      });
      next = { ...next, codeTaskExecutionRunsV1: nextRuns };
    }
    if (execution && isInFlightTaskCursorExecution(execution)) {
      execution = markTaskCursorStopped(
        execution,
        nowIso,
        "Cursor Agent가 생성되지 않아 실행을 중단했습니다.",
      );
      next = { ...next, taskCursorExecutionV1: execution };
    }
  }

  next = mergeRequirementsStateWithRuntime({
    projectId: input.projectId,
    state: next,
    nowIso,
  });

  const runtimeAfter = deriveImplementationRuntimeFromRequirementsState({
    raw: next,
    projectId: input.projectId,
    nowIso,
  });
  let redispatch: ImplementationRuntimeActiveDispatchV1 | null = null;
  if (plan.shouldRedispatch) {
    redispatch = buildActiveDispatchFromRuntimeHead({
      runtime: runtimeAfter,
      runs: parseCodeTaskExecutionRunsV1(next.codeTaskExecutionRunsV1) ?? runs,
    });
    if (redispatch) {
      next = stripLegacyImplementationRuntimeStateFromRecord({
        ...next,
        implementationRuntimeUiSnapshotV1: buildPersistedActiveDispatchSnapshotPatch({
          projectId: input.projectId,
          dispatch: redispatch,
          baseState: next,
          nowIso,
        }),
      });
    }
  }

  return {
    patch: next,
    userMessage: plan.markStale ? EXECUTION_STALE_USER_MESSAGE : null,
    redispatch,
    shouldWatchdogPoll: plan.shouldWatchdogPoll,
    issues: plan.issues,
  };
}
