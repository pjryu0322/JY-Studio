import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { classifyCodeTaskExecutionRunFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunResult";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  updateCodeTaskExecutionRun,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";

/** TaskCursorExecutionV1 → CodeTaskExecutionRunV1 adapter */
export function syncCodeTaskExecutionRunsFromTaskCursor(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly execution: TaskCursorExecutionV1;
  readonly codeTaskId: string;
  readonly workItemId: string;
  readonly nowIso?: string;
}): CodeTaskExecutionRunV1[] {
  const codeTaskId = input.codeTaskId.trim();
  const now = input.nowIso ?? new Date().toISOString();
  let runs = [...(input.runs ?? [])];
  let run = runs.find(
    (r) =>
      r.codeTaskId === codeTaskId &&
      (r.cursorRunId === input.execution.cursorRunId || isInFlightCodeTaskExecutionRunStatus(r.status)),
  ) ?? findLatestRunForCodeTask(runs, codeTaskId);

  if (!run) {
    run = createCodeTaskExecutionRun({
      projectId: input.execution.projectId,
      processTaskId: input.execution.taskId,
      workItemId: input.workItemId,
      codeTaskId,
      runs,
      nowIso: now,
    });
    runs = appendCodeTaskExecutionRun(runs, run);
  }

  const classified = classifyCodeTaskExecutionRunFromTaskCursor(input.execution);
  return updateCodeTaskExecutionRun(runs, run.runId, {
    status: classified.status,
    repository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    cursorRunId: input.execution.cursorRunId,
    commitSha: input.execution.commitSha,
    changedFiles: input.execution.changedFiles,
    branchHeadCommitSha: classified.branchHeadCommitSha,
    noCodeChangeEvidence: classified.noCodeChangeEvidence,
    failureReason: classified.failureReason,
    errorMessage: classified.errorMessage,
    updatedAt: now,
  });
}
