import {
  DEFAULT_CURSOR_API_BASE,
  normalizeCursorApiBaseUrl,
} from "@/lib/executionSetup/cursorApiValidation";
import {
  executeCursorApiDirect,
  type CursorApiDirectExecuteRequest,
  type CursorApiDirectExecuteResult,
} from "@/lib/prototype/cursorApiDirectClient";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { executeTaskCursorViaCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";
import {
  mapTaskCursorApiFailureReason,
  TASK_CURSOR_FAILURE_MESSAGES,
  validateTaskCursorExecuteApiResult,
  type TaskCursorExecuteApiResult,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";

export type TaskCursorApiExecuteRequest = Readonly<{
  readonly projectId: string;
  readonly taskId: string;
  readonly workItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly cursorApiUrl: string;
  readonly cursorApiToken: string;
  readonly targetRepository: ProjectTargetRepository;
  readonly workspacePath: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly commitMessage: string;
  readonly prompt: string;
  readonly allowedPathGlobs: readonly string[];
}>;

export function shouldUseTaskCursorCloudAgentApi(cursorApiUrl: string): boolean {
  return normalizeCursorApiBaseUrl(cursorApiUrl) === DEFAULT_CURSOR_API_BASE;
}

function mapDirectResultToTaskResult(
  request: TaskCursorApiExecuteRequest,
  result: CursorApiDirectExecuteResult,
): TaskCursorExecuteApiResult {
  if (result.status === "unsupported") {
    return {
      ok: false,
      status: "failed",
      taskId: request.taskId,
      reason: "cursor_endpoint_unsupported",
      message: TASK_CURSOR_FAILURE_MESSAGES.cursor_endpoint_unsupported,
    };
  }
  if (result.status === "blocked") {
    const reason = mapTaskCursorApiFailureReason({ message: result.errorMessage });
    return {
      ok: false,
      status: "blocked",
      taskId: request.taskId,
      reason,
      message: result.errorMessage ?? TASK_CURSOR_FAILURE_MESSAGES[reason],
    };
  }
  if (!result.ok || result.status !== "completed") {
    const reason = mapTaskCursorApiFailureReason({ message: result.errorMessage, status: result.status });
    return {
      ok: false,
      status: "failed",
      taskId: request.taskId,
      branchName: result.branchName ?? request.workBranch,
      commitSha: result.commitSha,
      changedFiles: result.changedFiles,
      reason,
      message: result.errorMessage ?? TASK_CURSOR_FAILURE_MESSAGES[reason],
    };
  }

  const mapped: TaskCursorExecuteApiResult = {
    ok: true,
    status: "completed",
    taskId: request.taskId,
    branchName: result.branchName ?? request.workBranch,
    commitSha: result.commitSha,
    pushed: result.pushed === true,
    changedFiles: result.changedFiles ?? [],
    diffSummary: result.diffSummary,
    testResults: result.testResults,
  };
  return validateTaskCursorExecuteApiResult(mapped);
}

export async function executeTaskCursorApi(
  request: TaskCursorApiExecuteRequest,
): Promise<TaskCursorExecuteApiResult> {
  if (shouldUseTaskCursorCloudAgentApi(request.cursorApiUrl)) {
    return executeTaskCursorViaCloudAgent(request);
  }

  const directRequest: CursorApiDirectExecuteRequest = {
    projectId: request.projectId,
    selectedTaskId: request.taskId,
    selectedWorkItemIds: request.workItemIds,
    workItems: request.workItems,
    cursorApiUrl: request.cursorApiUrl,
    cursorApiToken: request.cursorApiToken,
    targetRepository: request.targetRepository,
    workspacePath: request.workspacePath,
    baseBranch: request.baseBranch,
    branchName: request.workBranch,
    commitMessage: request.commitMessage,
    prompt: request.prompt,
    autoCommit: true,
    autoPush: true,
    autoPr: false,
    allowedPathGlobs: request.allowedPathGlobs,
  };

  try {
    const result = await executeCursorApiDirect(directRequest);
    const mapped = mapDirectResultToTaskResult(request, result);
    if (!mapped.ok && mapped.reason === "cursor_endpoint_unsupported") {
      return executeTaskCursorViaCloudAgent(request);
    }
    return mapped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason: TaskCursorFailureReason = mapTaskCursorApiFailureReason({ message });
    return {
      ok: false,
      status: "failed",
      taskId: request.taskId,
      reason,
      message: message || TASK_CURSOR_FAILURE_MESSAGES[reason],
    };
  }
}

export function buildTaskCursorAuthRef(input: {
  readonly hasGithubAccessToken: boolean;
  readonly hasCursorToken: boolean;
}): Readonly<{ readonly hasGithubAccessToken: boolean; readonly hasCursorToken: boolean }> {
  return {
    hasGithubAccessToken: input.hasGithubAccessToken,
    hasCursorToken: input.hasCursorToken,
  };
}
