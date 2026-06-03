import { findActiveImplementationExecutionJob } from "@/lib/prototype/implementationExecutionJob";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import {
  parseTaskCursorExecutionV1,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { TaskCursorGithubVerifyInput } from "@/lib/prototype/taskCursorGithubVerify";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

export function buildGithubVerifyInputForRuntimeSync(input: {
  readonly execution: TaskCursorExecutionV1 | null | undefined;
  readonly githubToken?: string | null;
  readonly targetRepository?: ProjectTargetRepository | null;
  readonly allowedPathGlobs?: readonly string[] | null;
}): TaskCursorGithubVerifyInput | null {
  const execution = input.execution;
  if (!execution) return null;
  const githubToken = String(input.githubToken ?? "").trim();
  if (!githubToken) return null;
  const targetRepository = input.targetRepository;
  if (!targetRepository) return null;
  return {
    execution,
    targetRepository,
    githubToken,
    allowedPathGlobs: input.allowedPathGlobs ?? [],
  };
}

/** 서버 Task Cursor job 폴링 후 DB Runtime 동기화 (GitHub verify + advance 포함) */
export async function syncDbRuntimeAfterTaskCursorServerPoll(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly codeTaskId?: string | null;
  readonly execution: ReturnType<typeof parseTaskCursorExecutionV1>;
  readonly githubVerify?: TaskCursorGithubVerifyInput | null;
}): Promise<void> {
  if (!input.execution) return;
  await syncImplementationRuntimeFromTaskCursor({
    projectId: input.projectId,
    taskId: input.taskId,
    codeTaskId: input.codeTaskId,
    execution: input.execution,
    githubVerify: input.githubVerify ?? null,
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
