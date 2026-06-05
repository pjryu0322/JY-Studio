import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { resolveFirstIncompleteSelectedCodeTaskId } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isTerminalCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import {
  isGithubProgressPollDue,
  parseGithubProgressLastCheckMs,
  resolveEffectiveGithubLaunchMs,
  TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type {
  ImplementationRuntimeBundleView,
  RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { isRuntimeInFlight } from "@/lib/prototype/implementationRuntimeState";
import { CODE_TASK_EXECUTION_RUN_VERSION, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildCodeTaskWorkBranch,
  buildTaskCursorWorkBranch,
  TASK_CURSOR_EXECUTION_VERSION,
  type TaskCursorExecutionStatus,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";

const RECOVERABLE_EXECUTION_STATUSES = new Set<TaskCursorExecutionStatus>([
  "cursor_running",
  "cursor_requested",
  "cursor_completed",
  "github_verifying",
  "status_check_stopped",
]);

function hasRecordedCommit(input: {
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly execution: TaskCursorExecutionV1 | null;
}): boolean {
  return Boolean(
    String(input.run?.commitSha ?? input.run?.branchHeadCommitSha ?? "").trim() ||
      String(input.execution?.commitSha ?? input.execution?.branchHeadCommitSha ?? "").trim(),
  );
}

function mapDbRuntimeStateToRunStatus(state: RuntimeState): CodeTaskExecutionRunV1["status"] {
  switch (state) {
    case "github_verifying":
      return "github_verifying";
    case "completed":
      return "completed";
    case "failed":
    case "stale":
      return "failed";
    case "cursor_running":
    case "dispatching":
      return "cursor_running";
    default:
      return "queued";
  }
}

/** JSON runs가 queued로 남아도 DB Runtime run 증거를 합친다. */
export function mergeCodeTaskRunsWithDbRuntime(input: {
  readonly jsonRuns: readonly CodeTaskExecutionRunV1[];
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): readonly CodeTaskExecutionRunV1[] {
  const dbRuns = input.dbBundle?.runs ?? [];
  if (!dbRuns.length) return input.jsonRuns;

  const byTask = new Map(input.jsonRuns.map((run) => [run.codeTaskId, run]));
  for (const dbRun of dbRuns) {
    const codeTaskId = dbRun.codeTaskId.trim();
    if (!codeTaskId) continue;
    const parentTaskId =
      input.codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId)?.parentTaskId?.trim() ??
      byTask.get(codeTaskId)?.processTaskId ??
      "";
    const workItemId = byTask.get(codeTaskId)?.workItemId ?? "";
    const mapped: CodeTaskExecutionRunV1 = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: dbRun.id,
      projectId: dbRun.projectId,
      processTaskId: parentTaskId || codeTaskId,
      workItemId,
      codeTaskId,
      status: mapDbRuntimeStateToRunStatus(dbRun.runtimeState),
      attemptNo: byTask.get(codeTaskId)?.attemptNo ?? 1,
      cursorRunId: dbRun.cursorAgentId ?? byTask.get(codeTaskId)?.cursorRunId,
      workBranch: dbRun.branchName ?? byTask.get(codeTaskId)?.workBranch,
      commitSha: dbRun.commitSha ?? byTask.get(codeTaskId)?.commitSha,
      branchHeadCommitSha: dbRun.commitSha ?? byTask.get(codeTaskId)?.branchHeadCommitSha,
      createdAt: dbRun.startedAt ?? dbRun.updatedAt,
      updatedAt: dbRun.updatedAt,
      startedAt: dbRun.startedAt ?? undefined,
      completedAt: dbRun.completedAt ?? undefined,
    };
    const prior = byTask.get(codeTaskId);
    if (!prior || mapped.status !== "queued" || prior.status === "queued") {
      byTask.set(codeTaskId, prior ? { ...prior, ...mapped } : mapped);
    }
  }
  return [...byTask.values()];
}

export function resolveQuickRunGithubRecoveryQueue(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly jsonQueue?: CodeTaskExecutionQueueV1 | null;
}): CodeTaskExecutionQueueV1 | null {
  const fromDb = input.dbBundle?.job?.id
    ? buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle: input.dbBundle })
    : null;
  if (fromDb?.status === "running") return fromDb;
  if (input.jsonQueue?.status === "running") return input.jsonQueue;
  return fromDb ?? input.jsonQueue ?? null;
}

function resolveWorkBranch(input: {
  readonly parentTaskId: string;
  readonly codeTaskId?: string;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
}): string {
  const explicit = String(
    input.execution?.workBranch ?? input.run?.workBranch ?? "",
  ).trim();
  if (explicit) return explicit;
  const codeTaskId = input.codeTaskId?.trim() ?? input.run?.codeTaskId?.trim() ?? "";
  if (codeTaskId) return buildCodeTaskWorkBranch(codeTaskId);
  return buildTaskCursorWorkBranch(input.parentTaskId);
}

/** verify-github API에 넘길 execution — history/run만으로도 구성 */
export function buildGithubVerifyExecutionFromRunContext(input: {
  readonly projectId: string;
  readonly parentTaskId: string;
  readonly codeTaskId?: string;
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly execution: TaskCursorExecutionV1 | null;
}): TaskCursorExecutionV1 | null {
  const cursorRunId = String(input.run?.cursorRunId ?? input.execution?.cursorRunId ?? "").trim();
  if (!cursorRunId) return null;

  const workBranch = resolveWorkBranch({
    parentTaskId: input.parentTaskId,
    codeTaskId: input.codeTaskId ?? input.run?.codeTaskId,
    execution: input.execution,
    run: input.run,
  });

  const executionForTask =
    input.execution &&
    input.execution.taskId === input.parentTaskId &&
    (!input.run?.cursorRunId || input.execution.cursorRunId === input.run.cursorRunId)
      ? input.execution
      : null;

  if (executionForTask) {
    const status = RECOVERABLE_EXECUTION_STATUSES.has(executionForTask.status)
      ? executionForTask.status
      : "cursor_running";
    return {
      ...executionForTask,
      workBranch,
      cursorRunId,
      commitSha: undefined,
      branchHeadCommitSha: undefined,
      status: status === "status_check_stopped" ? "cursor_running" : status,
    };
  }

  if (!input.run) return null;
  return {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId: input.projectId.trim(),
    taskId: input.parentTaskId.trim(),
    workItemIds: [],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: String(input.run.repository ?? "").trim(),
    baseBranch: String(input.run.baseBranch ?? "main").trim() || "main",
    workBranch,
    cursorRunId,
    createdAt: input.run.createdAt,
    updatedAt: input.run.updatedAt,
  };
}

function dbRunNeedsGithubVerify(run: {
  readonly runtimeState: RuntimeState;
  readonly commitSha?: string | null;
}): boolean {
  return isRuntimeInFlight(run.runtimeState) && !String(run.commitSha ?? "").trim();
}

/** GitHub verify 대상 CodeTask — DB current/job 우선 (2번째 Task 등 순차 실행). */
export function resolveQuickRunGithubVerifyCodeTaskId(input: {
  readonly queue: CodeTaskExecutionQueueV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
}): string | null {
  const selected = input.queue.selectedCodeTaskIds;

  const cur = input.dbBundle?.currentRun;
  if (
    cur?.codeTaskId &&
    selected.includes(cur.codeTaskId) &&
    dbRunNeedsGithubVerify(cur)
  ) {
    return cur.codeTaskId;
  }

  for (const dbRun of input.dbBundle?.runs ?? []) {
    const id = dbRun.codeTaskId?.trim();
    if (!id || !selected.includes(id)) continue;
    if (dbRunNeedsGithubVerify(dbRun)) return id;
  }

  const jobCurrent = input.dbBundle?.job?.currentCodeTaskId?.trim();
  if (jobCurrent && selected.includes(jobCurrent)) {
    const jsonRun = findLatestRunForCodeTask(input.runs, jobCurrent);
    if (
      !jsonRun ||
      (jsonRun.status !== "completed" && jsonRun.status !== "no_code_change_completed")
    ) {
      return jobCurrent;
    }
  }

  const active = input.taskCursorExecution;
  const activeRunId = String(active?.cursorRunId ?? "").trim();
  if (
    active &&
    activeRunId &&
    (active.status === "cursor_running" || active.status === "cursor_requested")
  ) {
    const byAgent = input.runs.find(
      (r) =>
        selected.includes(r.codeTaskId) &&
        String(r.cursorRunId ?? "").trim() === activeRunId,
    );
    if (byAgent) return byAgent.codeTaskId;

    const parentId = active.taskId.trim();
    const candidates = (input.codeTaskPlan?.tasks ?? []).filter(
      (t) => t.parentTaskId.trim() === parentId && selected.includes(t.codeTaskId),
    );
    if (candidates.length === 1) return candidates[0]!.codeTaskId;
    const atIndex = selected[input.queue.currentIndex];
    if (atIndex && candidates.some((c) => c.codeTaskId === atIndex)) return atIndex;
  }

  const fallback =
    resolveFirstIncompleteSelectedCodeTaskId({ queue: input.queue, runs: input.runs }) ??
    String(selected[input.queue.currentIndex] ?? "").trim();
  return fallback || null;
}

/** Quick Run이 Cursor 구간에서 멈춘 뒤 GitHub WIP branch만 있는 경우 — verify-github로 복구할 대상 */
export function resolveQuickRunStuckGithubVerifyTarget(input: {
  readonly projectId: string;
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): TaskCursorExecutionV1 | null {
  const queue =
    resolveQuickRunGithubRecoveryQueue({
      dbBundle: input.dbBundle,
      jsonQueue: input.queue,
    }) ?? input.queue;
  if (queue?.status !== "running") return null;

  const runs = mergeCodeTaskRunsWithDbRuntime({
    jsonRuns: input.runs ?? [],
    dbBundle: input.dbBundle,
    codeTaskPlan: input.codeTaskPlan,
  });
  if (!queue.selectedCodeTaskIds.length || queue.currentIndex < 0) return null;

  const codeTaskId = resolveQuickRunGithubVerifyCodeTaskId({
    queue,
    runs,
    dbBundle: input.dbBundle,
    codeTaskPlan: input.codeTaskPlan,
    taskCursorExecution: input.taskCursorExecution ?? null,
  });
  if (!codeTaskId) return null;

  const parentTaskId =
    input.codeTaskPlan?.tasks.find((task) => task.codeTaskId === codeTaskId)?.parentTaskId?.trim() ??
    "";
  if (!parentTaskId) return null;

  const run = findLatestRunForCodeTask(runs, codeTaskId);
  const historyExecutionEarly = resolveTaskCursorExecutionForRow({
    taskId: parentTaskId,
    taskCursorExecutionV1: input.taskCursorExecution ?? null,
    taskCursorExecutionHistoryV1: input.taskCursorExecutionHistory ?? null,
  });
  const cursorRunIdFromState = String(
    run?.cursorRunId ?? historyExecutionEarly?.cursorRunId ?? "",
  ).trim();
  if (
    run &&
    (run.status === "queued" || run.status === "prompt_ready") &&
    !cursorRunIdFromState
  ) {
    return null;
  }
  if (run && !cursorRunIdFromState && run.status !== "cursor_running" && run.status !== "github_verifying") {
    return null;
  }
  if (run && isTerminalCodeTaskExecutionRunStatus(run.status)) {
    if (run.status === "completed" || run.status === "no_code_change_completed") {
      return null;
    }
  }

  const historyExecution = historyExecutionEarly;

  const workBranch = resolveWorkBranch({
    parentTaskId,
    codeTaskId,
    execution: historyExecution,
    run,
  });
  const dbRunForTask =
    input.dbBundle?.runs.find((r) => r.codeTaskId === codeTaskId) ?? input.dbBundle?.currentRun;

  const awaitingGithubVerify =
    run?.status === "github_verifying" ||
    historyExecution?.status === "github_verifying" ||
    dbRunForTask?.runtimeState === "github_verifying";
  if (!awaitingGithubVerify && hasRecordedCommit({ run, execution: historyExecution })) {
    return null;
  }
  const launchMs = resolveEffectiveGithubLaunchMs({
    quickRun: input.quickRun,
    run: run ?? undefined,
    dbRun: dbRunForTask?.codeTaskId === codeTaskId ? dbRunForTask : input.dbBundle?.currentRun,
    execution: historyExecution ?? undefined,
  });
  const lastCheckMs = parseGithubProgressLastCheckMs(historyExecution);
  if (!isGithubProgressPollDue({ launchMs, lastCheckMs })) {
    return null;
  }

  const verifyExecution = buildGithubVerifyExecutionFromRunContext({
    projectId: input.projectId,
    parentTaskId,
    codeTaskId,
    run,
    execution: historyExecution,
  });
  if (!verifyExecution) return null;

  const quickRun = input.quickRun;
  if (
    quickRun &&
    quickRun.status !== "running" &&
    quickRun.status !== "paused" &&
    quickRun.status !== "blocked" &&
    quickRun.status !== "failed"
  ) {
    return null;
  }

  return verifyExecution;
}

export function buildQuickRunStuckGithubVerifyDedupeKey(
  execution: TaskCursorExecutionV1,
  codeTaskId: string,
  nowMs: number = Date.now(),
): string {
  const bucket = Math.floor(nowMs / TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS);
  return `${codeTaskId}:${String(execution.cursorRunId ?? "").trim()}:github-recover:${bucket}`;
}
