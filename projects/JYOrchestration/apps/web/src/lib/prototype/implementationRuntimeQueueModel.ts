import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { getCurrentQueueCodeTaskId } from "@/lib/prototype/codeTaskExecutionQueue";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import { isTerminalCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { CodeTaskRun } from "@/lib/prototype/implementationRuntimeStateModel";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

export type ImplementationRuntimeQueue = Readonly<{
  readonly selectedRunIds: readonly string[];
  readonly currentRunId?: string | null;
  readonly executionOrder: readonly string[];
  readonly completedRunIds: readonly string[];
  readonly blockedRunIds: readonly string[];
  readonly skippedRunIds: readonly string[];
}>;

function isRunnableRunStatus(status: CodeTaskExecutionRunV1["status"]): boolean {
  if (isTerminalCodeTaskExecutionRunStatus(status)) return false;
  if (status === "completed" || status === "no_code_change_completed") return false;
  if (status === "github_verified") return false;
  if (status === "failed" || status === "rework_required") return false;
  if (status === "skipped_by_user") return false;
  if (status === "blocked_by_dependency") return false;
  return status === "queued" || status === "prompt_ready" || status === "prompt_building";
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
    .filter((r) => r.status === "completed" || r.status === "no_code_change_completed")
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
}): CodeTaskRun | null {
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
