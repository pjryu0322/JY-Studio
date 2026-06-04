import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  parseTaskCursorExecutionV1,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type {
  TaskCursorGithubVerifyInput,
  TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
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
  readonly githubVerifyResult?: TaskCursorGithubVerifyResult | null;
}): Promise<void> {
  if (!input.execution) return;
  await syncImplementationRuntimeFromTaskCursor({
    projectId: input.projectId,
    taskId: input.taskId,
    codeTaskId: input.codeTaskId,
    execution: input.execution,
    githubVerifyResult: input.githubVerifyResult ?? null,
    githubVerify: input.githubVerify ?? null,
  });
}

export { shouldSyncTaskCursorServerJobPollState } from "@/lib/prototype/taskCursorServerJobPollState";
