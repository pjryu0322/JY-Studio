import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

export function resolveCodeTaskDispatchTarget(input: {
  readonly codeTaskId: string;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): Readonly<{
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask: ImplementationTaskV1 | null;
  readonly parentTaskId: string;
  readonly workItem: CursorWorkItem;
}> | null {
  const codeTaskId = input.codeTaskId.trim();
  const codeTask = input.codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId);
  if (!codeTask) return null;
  const parentTaskId = codeTask.parentTaskId;
  const parentTask =
    input.taskList?.tasks.find((t) => t.taskId === parentTaskId) ?? null;
  const workItem =
    (input.cursorWorkItems ?? []).find(
      (w) => w.codeTaskId === codeTaskId || w.id === `cursor-wi-${codeTaskId}`,
    ) ??
    (input.cursorWorkItems ?? []).find((w) => w.taskId === parentTaskId && w.codeTaskId === codeTaskId);
  if (!workItem) return null;
  return { codeTask, parentTask, parentTaskId, workItem };
}
