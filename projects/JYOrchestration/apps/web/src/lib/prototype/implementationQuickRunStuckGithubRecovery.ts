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

function resolveWorkBranch(input: {
  readonly parentTaskId: string;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
}): string {
  return String(
    input.execution?.workBranch ??
      input.run?.workBranch ??
      buildTaskCursorWorkBranch(input.parentTaskId),
  ).trim();
}

/** verify-github API에 넘길 execution — history/run만으로도 구성 */
export function buildGithubVerifyExecutionFromRunContext(input: {
  readonly projectId: string;
  readonly parentTaskId: string;
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly execution: TaskCursorExecutionV1 | null;
}): TaskCursorExecutionV1 | null {
  const cursorRunId = String(input.execution?.cursorRunId ?? input.run?.cursorRunId ?? "").trim();
  if (!cursorRunId) return null;

  const workBranch = resolveWorkBranch({
    parentTaskId: input.parentTaskId,
    execution: input.execution,
    run: input.run,
  });

  if (input.execution) {
    const status = RECOVERABLE_EXECUTION_STATUSES.has(input.execution.status)
      ? input.execution.status
      : "cursor_running";
    return {
      ...input.execution,
      workBranch,
      cursorRunId,
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

/** Quick Run이 Cursor 구간에서 멈춘 뒤 GitHub WIP branch만 있는 경우 — verify-github로 복구할 대상 */
export function resolveQuickRunStuckGithubVerifyTarget(input: {
  readonly projectId: string;
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
}): TaskCursorExecutionV1 | null {
  const queue = input.queue;
  if (queue?.status !== "running") return null;
  if (!queue.selectedCodeTaskIds.length || queue.currentIndex < 0) return null;

  const codeTaskId =
    resolveFirstIncompleteSelectedCodeTaskId({
      queue,
      runs: input.runs ?? [],
    }) ?? String(queue.selectedCodeTaskIds[queue.currentIndex] ?? "").trim();
  if (!codeTaskId) return null;

  const parentTaskId =
    input.codeTaskPlan?.tasks.find((task) => task.codeTaskId === codeTaskId)?.parentTaskId?.trim() ??
    "";
  if (!parentTaskId) return null;

  const run = findLatestRunForCodeTask(input.runs ?? [], codeTaskId);
  if (run && isTerminalCodeTaskExecutionRunStatus(run.status)) {
    if (run.status === "completed" || run.status === "no_code_change_completed") {
      return null;
    }
  }

  const historyExecution = resolveTaskCursorExecutionForRow({
    taskId: parentTaskId,
    taskCursorExecutionV1: input.taskCursorExecution ?? null,
    taskCursorExecutionHistoryV1: input.taskCursorExecutionHistory ?? null,
  });

  if (hasRecordedCommit({ run, execution: historyExecution })) return null;

  const verifyExecution = buildGithubVerifyExecutionFromRunContext({
    projectId: input.projectId,
    parentTaskId,
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
): string {
  return `${codeTaskId}:${String(execution.cursorRunId ?? "").trim()}:github-recover`;
}
