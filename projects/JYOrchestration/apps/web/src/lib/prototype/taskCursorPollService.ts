import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  applyTaskCursorApiResult,
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorApiCompletedTimeline,
  buildTaskCursorApiFailedTimeline,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { pollTaskCursorCloudAgentStep } from "@/lib/prototype/taskCursorCloudAgentClient";
import { isTerminalTaskCursorPollResultStatus } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  isCursorCloudAgentRunId,
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

export type TaskCursorPollOnceResult = Readonly<{
  readonly success: boolean;
  readonly status: string;
  readonly message?: string;
  readonly agentStatus?: string;
  readonly execution: TaskCursorExecutionV1;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly terminal: boolean;
  readonly nextPollDelayMs?: number;
}>;

export type TaskCursorPollRuntimeContext = Readonly<{
  readonly cursorApiUrl: string;
  readonly cursorApiToken: string;
  readonly githubToken: string;
  readonly targetRepository: ProjectTargetRepository;
  readonly workspaceRoot: string;
  readonly baseBranch: string;
  readonly allowedPathGlobs: readonly string[];
}>;

export async function pollTaskCursorExecutionOnce(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  readonly existingCodeTaskExecutionFeedback?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly verifyGithub: boolean;
  readonly nowIso?: string;
  readonly context: TaskCursorPollRuntimeContext;
}): Promise<TaskCursorPollOnceResult> {
  const projectId = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const execution = input.execution;
  const executionState = input.implementationTaskExecutionStateV1 ?? null;
  const buildPatch = (
    nextExecution: TaskCursorExecutionV1,
    timelineEntries: readonly RequirementsPromptTimelineEntry[],
  ) =>
    buildTaskCursorOrchestrationPatch({
      execution: nextExecution,
      timelineEntries,
      cursorWorkItems: input.workItems,
      ...(executionState ? { executionState } : {}),
      ...(input.existingCodeTaskExecutionFeedback
        ? { existingCodeTaskExecutionFeedback: input.existingCodeTaskExecutionFeedback }
        : {}),
      ...(input.codeTaskQualityGate ? { codeTaskQualityGate: input.codeTaskQualityGate } : {}),
    });

  const agentId = String(execution.cursorRunId ?? "").trim();
  if (!agentId) {
    const nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });
    return {
      success: false,
      status: "poll_not_ready",
      message: "cursorRunId(Cloud Agent id)가 없습니다.",
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, []),
      terminal: false,
      nextPollDelayMs: 10_000,
    };
  }
  if (!isCursorCloudAgentRunId(agentId)) {
    const nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });
    return {
      success: false,
      status: "poll_not_ready",
      message: "Cloud Agent ID가 아직 준비되지 않았습니다.",
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, []),
      terminal: false,
      nextPollDelayMs: 10_000,
    };
  }

  const pollStep = await pollTaskCursorCloudAgentStep({
    request: {
      projectId,
      taskId: execution.taskId,
      workItemIds: execution.workItemIds,
      workItems: input.workItems,
      cursorApiUrl: input.context.cursorApiUrl,
      cursorApiToken: input.context.cursorApiToken,
      targetRepository: input.context.targetRepository,
      workspacePath: input.context.workspaceRoot,
      baseBranch: input.context.baseBranch,
      workBranch: execution.workBranch,
      commitMessage: "",
      prompt: execution.cursorPrompt ?? "",
      allowedPathGlobs: input.context.allowedPathGlobs,
    },
    agentId,
  });

  const timeline: RequirementsPromptTimelineEntry[] = [];
  let nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });

  if (pollStep.kind === "running") {
    nextExecution = patchTaskCursorExecution(execution, {
      status: "cursor_running",
      cursorAgentStatus: pollStep.statusUpper,
      nowIso,
    });
    return {
      success: true,
      status: "cursor_running",
      agentStatus: pollStep.statusUpper,
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, timeline),
      terminal: false,
      nextPollDelayMs: 10_000,
    };
  }

  if (pollStep.kind === "failed") {
    nextExecution = patchTaskCursorExecution(execution, {
      status: "cursor_failed",
      failureReason: pollStep.reason,
      errorMessage: pollStep.message,
      nowIso,
    });
    timeline.push(buildTaskCursorApiFailedTimeline({ execution: nextExecution, nowIso }));
    return {
      success: false,
      status: nextExecution.status,
      message: pollStep.message,
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, timeline),
      terminal: true,
    };
  }

  nextExecution = applyTaskCursorApiResult({
    execution,
    result: pollStep.result,
    nowIso,
  });
  timeline.push(buildTaskCursorApiCompletedTimeline({ execution: nextExecution, nowIso }));

  const verifyGithub = input.verifyGithub !== false;
  if (nextExecution.status === "cursor_completed" && verifyGithub && input.context.githubToken) {
    nextExecution = patchTaskCursorExecution(nextExecution, { status: "github_verifying", nowIso });
    timeline.push(
      buildTaskCursorTimelineEntry({
        action: "task_cursor_github_verify_requested",
        projectId,
        taskId: execution.taskId,
        status: "github_verifying",
        targetRepository: nextExecution.targetRepository,
        baseBranch: nextExecution.baseBranch,
        workBranch: nextExecution.workBranch,
        commitSha: nextExecution.commitSha,
        runId: nextExecution.cursorRunId,
        nowIso,
      }),
    );
    const verify = await verifyTaskCursorGithubResult({
      execution: nextExecution,
      targetRepository: input.context.targetRepository,
      githubToken: input.context.githubToken,
      allowedPathGlobs: input.context.allowedPathGlobs,
    });
    nextExecution = applyTaskCursorGithubVerifyResult({
      execution: nextExecution,
      ok: verify.ok,
      message: verify.message,
      reason: verify.reason,
      verifiedChangedFiles: verify.verifiedChangedFiles,
      verifiedCommitSha: verify.verifiedCommitSha,
      nowIso,
    });
    if (nextExecution.status === "github_verified") {
      nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
    }
    timeline.push(
      buildTaskCursorGithubVerifyTimeline({
        execution: nextExecution,
        ok: verify.ok,
        reason: verify.reason,
        nowIso,
      }),
    );
  }

  const status = nextExecution.status;
  return {
    success: pollStep.result.ok,
    status,
    execution: nextExecution,
    orchestrationPatch: buildPatch(nextExecution, timeline),
    terminal: isTerminalTaskCursorPollResultStatus(status),
    nextPollDelayMs: isTerminalTaskCursorPollResultStatus(status) ? undefined : 10_000,
  };
}
