import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { getCurrentQueueCodeTaskId } from "@/lib/prototype/codeTaskExecutionQueue";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isTerminalCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import { runHasQualityGatePassed } from "@/lib/prototype/codeTaskQualityOutcome";
import type { CursorSession } from "@/lib/prototype/cursorSessionModel";
import type { CodeTaskRun } from "@/lib/prototype/implementationRuntimeStateModel";
import { isCodeTaskRunnableByBranchPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type ImplementationRuntimeQueue = Readonly<{
  readonly selectedRunIds: readonly string[];
  readonly currentRunId?: string | null;
  readonly executionOrder: readonly string[];
  readonly completedRunIds: readonly string[];
  readonly blockedRunIds: readonly string[];
  readonly skippedRunIds: readonly string[];
}>;

const QUEUE_TERMINAL_STATUSES = new Set<CodeTaskExecutionRunV1["status"]>([
  "completed",
  "quality_gate_passed",
  "no_code_change_completed",
  "skipped_by_user",
  "rework_required",
  "failed",
  "status_check_stopped",
]);

const QUEUE_RETRY_HOLD_STATUSES = new Set<CodeTaskExecutionRunV1["status"]>([
  "failed",
  "rework_required",
]);

function isRunnableRunStatus(status: CodeTaskExecutionRunV1["status"]): boolean {
  if (QUEUE_TERMINAL_STATUSES.has(status)) return false;
  if (status === "github_verified") return false;
  if (status === "blocked_by_dependency") return false;
  if (QUEUE_RETRY_HOLD_STATUSES.has(status)) return false;
  return (
    status === "queued" ||
    status === "prompt_building" ||
    status === "prompt_ready" ||
    status === "cursor_requested" ||
    status === "cursor_running" ||
    status === "github_verifying" ||
    status === "quality_gate_running"
  );
}

export function buildImplementationRuntimeQueueFromLegacy(input: {
  readonly queue: CodeTaskExecutionQueueV1 | null | undefined;
  readonly runs: readonly CodeTaskRun[];
}): ImplementationRuntimeQueue {
  const runs = input.runs;
  const order = input.queue?.selectedCodeTaskIds ?? [];
  const runByCodeTask = new Map<string, CodeTaskRun>();
  for (const id of order) {
    const run = findLatestRunForCodeTask(runs, id);
    if (run) runByCodeTask.set(id, run);
  }
  const executionOrder = order
    .map((id) => runByCodeTask.get(id)?.runId)
    .filter((id): id is string => Boolean(id?.trim()));
  const currentCodeTaskId = input.queue ? getCurrentQueueCodeTaskId(input.queue) : null;
  const currentRun = currentCodeTaskId ? findLatestRunForCodeTask(runs, currentCodeTaskId) : null;
  const completedRunIds = runs
    .filter(
      (r) =>
        r.status === "completed" ||
        r.status === "no_code_change_completed" ||
        r.status === "quality_gate_passed" ||
        runHasQualityGatePassed(r),
    )
    .map((r) => r.runId);
  const skippedRunIds = runs.filter((r) => r.status === "skipped_by_user").map((r) => r.runId);
  const blockedRunIds = runs.filter((r) => r.status === "blocked_by_dependency").map((r) => r.runId);
  return {
    selectedRunIds: executionOrder,
    currentRunId: currentRun?.runId ?? null,
    executionOrder,
    completedRunIds,
    blockedRunIds,
    skippedRunIds,
  };
}

export function selectNextRunnableCodeTaskRun(input: {
  readonly queue: ImplementationRuntimeQueue;
  readonly runs: readonly CodeTaskRun[];
  readonly cursorSessions?: readonly CursorSession[];
}): CodeTaskRun | null {
  void input.cursorSessions;
  const completed = new Set(input.queue.completedRunIds);
  const skipped = new Set(input.queue.skippedRunIds);
  const blocked = new Set(input.queue.blockedRunIds);
  for (const runId of input.queue.executionOrder) {
    if (completed.has(runId) || skipped.has(runId) || blocked.has(runId)) continue;
    const run = input.runs.find((r) => r.runId === runId);
    if (!run) continue;
    if (!isRunnableRunStatus(run.status)) continue;
    return run;
  }
  for (const run of input.runs) {
    if (completed.has(run.runId) || skipped.has(run.runId) || blocked.has(run.runId)) continue;
    if (isRunnableRunStatus(run.status)) return run;
  }
  return null;
}

/** 선택 배열에서 완료 CodeTask 다음 runnable id (Run 상태 기준, EventLog 미사용). */
export function findNextRunnableCodeTaskIdInSelection(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly afterCodeTaskId: string;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): string | null {
  const ids = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const after = input.afterCodeTaskId.trim();
  const start = ids.indexOf(after);
  if (start < 0) return null;
  const canRun = (codeTaskId: string) =>
    isCodeTaskRunnableByBranchPlan({
      codeTaskPlan: input.codeTaskPlan ?? null,
      selectedCodeTaskIds: ids,
      codeTaskId,
      runs: input.runs,
    });
  for (let i = start + 1; i < ids.length; i++) {
    const codeTaskId = ids[i]!;
    if (!canRun(codeTaskId)) continue;
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (!run) return codeTaskId;
    if (isTerminalCodeTaskExecutionRunStatus(run.status) || runHasQualityGatePassed(run)) {
      continue;
    }
    if (isRunnableRunStatus(run.status)) return codeTaskId;
    if (QUEUE_RETRY_HOLD_STATUSES.has(run.status)) return null;
    if (run.status === "github_verified") return null;
  }
  return null;
}
