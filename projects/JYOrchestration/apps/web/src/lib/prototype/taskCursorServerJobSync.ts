import { findActiveImplementationExecutionJob } from "@/lib/prototype/implementationExecutionJob";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

/** 서버 Task Cursor job 폴링 후 DB Runtime 동기화 (GitHub verify + advance 포함) */
export async function syncDbRuntimeAfterTaskCursorServerPoll(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly codeTaskId?: string | null;
  readonly execution: ReturnType<typeof parseTaskCursorExecutionV1>;
}): Promise<void> {
  if (!input.execution) return;
  await syncImplementationRuntimeFromTaskCursor({
    projectId: input.projectId,
    taskId: input.taskId,
    codeTaskId: input.codeTaskId,
    execution: input.execution,
  });
}

/** 로컬 requirements state가 서버 job 폴링·동기화를 추적 중인지 */
export function shouldSyncTaskCursorServerJobPollState(
  state: RequirementsStateJson | null | undefined,
): boolean {
  if (findActiveImplementationExecutionJob(state?.implementationExecutionJobsV1)) {
    return true;
  }

  const execution = parseTaskCursorExecutionV1(state?.taskCursorExecutionV1);
  if (execution && isInFlightTaskCursorExecution(execution)) return true;

  const quickRun = parseImplementationQuickRunV1(state?.implementationQuickRunV1);
  if (quickRun?.status === "running" || quickRun?.status === "paused") return true;

  return false;
}
