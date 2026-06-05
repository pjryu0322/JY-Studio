import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { pickFirstExecutableDeveloperTaskIdExcluding } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  findActiveImplementationExecutionJob,
  hasActiveJobForProcessTask,
  type ImplementationExecutionJobV1,
} from "@/lib/prototype/implementationExecutionJob";

export function pickNextRunnableProcessTaskId(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly jobs?: readonly ImplementationExecutionJobV1[] | null;
  readonly allowedTaskIds?: readonly string[] | null;
  readonly excludeTaskIds?: readonly string[];
}): string | null {
  const allowed =
    input.allowedTaskIds?.length
      ? new Set(input.allowedTaskIds.map((id) => id.trim()).filter(Boolean))
      : null;
  const exclude = new Set((input.excludeTaskIds ?? []).map((id) => id.trim()).filter(Boolean));

  const candidates = input.board.taskRows
    .filter((row) => row.developerStatus !== "done" && row.developerStatus !== "skipped")
    .filter((row) => !exclude.has(row.taskId))
    .filter((row) => !allowed || allowed.has(row.taskId))
    .filter((row) => !hasActiveJobForProcessTask(input.jobs, row.taskId));

  if (!candidates.length) return null;

  const sorted = [...candidates].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.taskId.localeCompare(b.taskId);
  });
  return sorted[0]?.taskId ?? null;
}

export function pickNextRunnableProcessTaskIdForQuickRun(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly jobs?: readonly ImplementationExecutionJobV1[] | null;
  readonly selectedTaskIds?: readonly string[];
}): string | null {
  if (findActiveImplementationExecutionJob(input.jobs, input.board.projectId)) {
    return null;
  }
  const allowed = input.selectedTaskIds?.length ? input.selectedTaskIds : null;
  const next = pickNextRunnableProcessTaskId({
    board: input.board,
    jobs: input.jobs,
    allowedTaskIds: allowed,
  });
  if (next) return next;
  return pickFirstExecutableDeveloperTaskIdExcluding(input.board, [], allowed);
}
