import "server-only";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

/** Task Cursor JSON 상태 변경 후 DB Runtime 동기화 (서버 전용). */
export async function syncDbImplementationRuntimeAfterTaskCursorChange(input: {
  readonly projectId: string;
  readonly codeTaskId?: string | null;
  readonly taskId?: string | null;
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso?: string;
}): Promise<void> {
  await syncImplementationRuntimeFromTaskCursor({
    projectId: input.projectId,
    codeTaskId: input.codeTaskId,
    taskId: input.taskId,
    execution: input.execution,
    now: input.nowIso ? new Date(input.nowIso) : undefined,
  });
}
