import {
  launchCursorAgent,
  pollCursorAgent,
  type CursorRunResult,
} from "@/lib/execution/cursorExecutionAdapter";
import { isCursorCodeReflectionConfirmed } from "@/lib/execution/cursorReflectionPolicy";
import { TASK_CURSOR_DEFERRED_GITHUB_VERIFY_HINT } from "@/lib/prototype/codeAgentWipDeliveryPolicy";
import {
  mapTaskCursorApiFailureReason,
  TASK_CURSOR_FAILURE_MESSAGES,
  validateTaskCursorExecuteApiResult,
  type TaskCursorExecuteApiResult,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";
import type { TaskCursorApiExecuteRequest } from "@/lib/prototype/taskCursorApiClient";

function buildExecutionSetupSlice(request: TaskCursorApiExecuteRequest) {
  return {
    cursorApiUrl: request.cursorApiUrl,
    cursorApiToken: request.cursorApiToken,
    gitRepoUrl: request.targetRepository.gitRepoUrl,
    baseBranch: request.baseBranch,
    branchStrategy: "feature-per-task" as const,
    branchPrefix: null,
    autoCommit: true,
    autoPush: true,
    autoPr: false,
    requireTestsBeforePush: false,
  };
}

function isCloudAgentTerminalSuccess(statusUpper: string): boolean {
  const status = statusUpper.toUpperCase();
  return status === "FINISHED" || status === "COMPLETED" || status === "DONE";
}

function isCloudAgentTerminalFailure(statusUpper: string): boolean {
  const status = statusUpper.toUpperCase();
  return (
    status === "FAILED" ||
    status === "ERROR" ||
    status === "CANCELLED" ||
    status === "CANCELED" ||
    status === "STOPPED"
  );
}

function mapCloudAgentResultToTaskResult(
  request: TaskCursorApiExecuteRequest,
  result: CursorRunResult,
): TaskCursorExecuteApiResult {
  if (!isCursorCodeReflectionConfirmed(result)) {
    return validateTaskCursorExecuteApiResult(
      {
        ok: true,
        status: "completed",
        taskId: request.taskId,
        branchName: result.branchName || request.workBranch,
        changedFiles: result.changedFiles ?? [],
        diffSummary: result.summary ? [result.summary] : undefined,
        testResults: [TASK_CURSOR_DEFERRED_GITHUB_VERIFY_HINT],
      },
      { deferCommitDiscoveryToGithub: true },
    );
  }
  const mapped: TaskCursorExecuteApiResult = {
    ok: true,
    status: "completed",
    taskId: request.taskId,
    branchName: result.branchName || request.workBranch,
    commitSha: result.commitHash,
    changedFiles: result.changedFiles ?? [],
    pushed: true,
    diffSummary: result.summary ? [result.summary] : undefined,
    testResults: ["Cloud Agent 완료 — GitHub verify에서 commit/files를 확인합니다."],
  };
  return validateTaskCursorExecuteApiResult(mapped, { allowEmptyChangedFilesWithCommit: true });
}

export async function launchTaskCursorCloudAgent(
  request: TaskCursorApiExecuteRequest,
): Promise<
  | { readonly ok: true; readonly agentId: string }
  | { readonly ok: false; readonly reason: TaskCursorFailureReason; readonly message: string }
> {
  const launch = await launchCursorAgent({
    projectId: request.projectId,
    executionSetup: buildExecutionSetupSlice(request),
    task: {
      id: request.taskId,
      title: request.taskId,
      description: null,
      acceptanceCriteria: [],
    },
    suggestedBranchName: request.workBranch,
    prompt: request.prompt,
    allowedPaths: request.allowedPathGlobs.length ? [...request.allowedPathGlobs] : undefined,
  });
  if (!launch.ok) {
    const message = launch.error;
    return {
      ok: false,
      reason: mapTaskCursorApiFailureReason({ message }),
      message,
    };
  }
  return { ok: true, agentId: launch.agentId };
}

export type TaskCursorCloudAgentPollStep =
  | { readonly kind: "running"; readonly statusUpper: string }
  | { readonly kind: "completed"; readonly result: TaskCursorExecuteApiResult }
  | { readonly kind: "failed"; readonly reason: TaskCursorFailureReason; readonly message: string };

export async function pollTaskCursorCloudAgentStep(input: {
  readonly request: TaskCursorApiExecuteRequest;
  readonly agentId: string;
}): Promise<TaskCursorCloudAgentPollStep> {
  const polled = await pollCursorAgent({
    cursorApiUrl: input.request.cursorApiUrl,
    cursorApiToken: input.request.cursorApiToken,
    agentId: input.agentId,
    fallbackBranchName: input.request.workBranch,
  });
  if (!polled.ok) {
    const message = polled.error;
    return {
      kind: "failed",
      reason: mapTaskCursorApiFailureReason({ message }),
      message,
    };
  }
  if (isCloudAgentTerminalFailure(polled.statusUpper)) {
    const message = polled.result.error || polled.result.summary || "Cloud Agent 실패";
    return {
      kind: "failed",
      reason: mapTaskCursorApiFailureReason({ message }),
      message,
    };
  }
  if (!isCloudAgentTerminalSuccess(polled.statusUpper)) {
    return { kind: "running", statusUpper: polled.statusUpper };
  }
  const mapped = mapCloudAgentResultToTaskResult(input.request, polled.result);
  if (!mapped.ok) {
    return {
      kind: "failed",
      reason: mapped.reason ?? "unknown",
      message: mapped.message ?? TASK_CURSOR_FAILURE_MESSAGES.unknown,
    };
  }
  return { kind: "completed", result: mapped };
}

export async function executeTaskCursorViaCloudAgent(
  request: TaskCursorApiExecuteRequest,
): Promise<TaskCursorExecuteApiResult> {
  const launch = await launchTaskCursorCloudAgent(request);
  if (!launch.ok) {
    return {
      ok: false,
      status: "failed",
      taskId: request.taskId,
      branchName: request.workBranch,
      reason: launch.reason,
      message: launch.message,
    };
  }

  const started = Date.now();
  const maxWaitMs = 45 * 60 * 1000;
  let first = true;
  while (Date.now() - started < maxWaitMs) {
    if (!first) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    first = false;
    const step = await pollTaskCursorCloudAgentStep({
      request,
      agentId: launch.agentId,
    });
    if (step.kind === "running") continue;
    if (step.kind === "failed") {
      return {
        ok: false,
        status: "failed",
        taskId: request.taskId,
        branchName: request.workBranch,
        reason: step.reason,
        message: step.message,
      };
    }
    return step.result;
  }

  return {
    ok: false,
    status: "failed",
    taskId: request.taskId,
    branchName: request.workBranch,
    reason: "unknown",
    message: "Cloud Agent 응답 시간 초과(폴링 한도).",
  };
}
