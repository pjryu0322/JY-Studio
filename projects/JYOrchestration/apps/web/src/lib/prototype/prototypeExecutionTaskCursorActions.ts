import {
  markDeveloperTasksDoneForWip,
  markDeveloperTaskFailedForTaskId,
  markPostDeveloperReviewTasksQueued,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import { TASK_CURSOR_POLL_CANCELLED_MESSAGE } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  resolveSelectedWorkItemsForExecution,
  updateImplementationCodeTaskExecutionFeedback,
  type ImplementationCodeTaskExecutionFeedbackV1,
} from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import { diagnoseImplementationCodeTaskFailure } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import {
  buildImplementationExecutionLogTimelineEntry,
  buildTaskCursorPollLifecycleTimelineEntry,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import {
  appendTaskCursorExecutionHistory,
  buildInitialTaskCursorExecution,
  buildTaskCursorPrompt,
  buildTaskCursorTimelineEntry,
  buildTaskCursorWorkBranch,
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecuteApiResult,
  type TaskCursorExecutionV1,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import {
  parseImplementationExecutionJobsV1,
  syncImplementationExecutionJobFromTaskCursor,
} from "@/lib/prototype/implementationExecutionJob";
import {
  parseCodeTaskExecutionRunsV1,
  syncCodeTaskExecutionRunsFromTaskCursor,
} from "@/lib/prototype/codeTaskExecutionRun";

export function buildTaskCursorExecutionRequest(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly workItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs: readonly string[];
  readonly existing?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const workBranch = buildTaskCursorWorkBranch(input.taskId);
  const commitMessage = buildProviderWipCommitMessage("cursor", `task ${input.taskId}`, false, input.taskId);
  const prompt = buildTaskCursorPrompt({
    taskId: input.taskId,
    workBranch,
    workItems: input.workItems,
    targetRepository: input.targetRepository,
    commitMessage,
    allowedPathGlobs: input.allowedPathGlobs,
  });
  const base =
    input.existing && input.existing.taskId === input.taskId
      ? input.existing
      : buildInitialTaskCursorExecution({
          projectId: input.projectId,
          taskId: input.taskId,
          workItemIds: input.workItemIds,
          targetRepository: input.targetRepository.repoFullName,
          baseBranch: input.baseBranch,
          workBranch,
          nowIso: now,
        });
  return patchTaskCursorExecution(base, {
    workItemIds: input.workItemIds,
    status: "prompt_ready",
    cursorPrompt: prompt,
    targetRepository: input.targetRepository.repoFullName,
    baseBranch: input.baseBranch,
    workBranch,
    failureReason: undefined,
    errorMessage: undefined,
    nowIso: now,
  });
}

export function applyTaskCursorApiResult(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly result: TaskCursorExecuteApiResult;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.result.ok || input.result.status !== "completed") {
    return patchTaskCursorExecution(input.execution, {
      status: "cursor_failed",
      failureReason: input.result.reason ?? "unknown",
      errorMessage: input.result.message ?? TASK_CURSOR_FAILURE_MESSAGES.unknown,
      nowIso: now,
    });
  }
  return patchTaskCursorExecution(input.execution, {
    status: "cursor_completed",
    commitSha: input.result.commitSha,
    changedFiles: input.result.changedFiles ?? [],
    diffSummary: input.result.diffSummary,
    testResults: input.result.testResults,
    pushed: input.result.pushed === true,
    failureReason: undefined,
    errorMessage: undefined,
    nowIso: now,
  });
}

export function applyTaskCursorGithubVerifyResult(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly ok: boolean;
  readonly message?: string;
  readonly reason?: TaskCursorFailureReason;
  readonly verifiedChangedFiles?: readonly string[];
  readonly verifiedCommitSha?: string;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.ok) {
    return patchTaskCursorExecution(input.execution, {
      status: "github_verify_failed",
      failureReason: input.reason ?? "github_verify_failed",
      errorMessage: input.message ?? TASK_CURSOR_FAILURE_MESSAGES.github_verify_failed,
      nowIso: now,
    });
  }
  return patchTaskCursorExecution(input.execution, {
    status: "github_verified",
    commitSha: input.verifiedCommitSha ?? input.execution.commitSha,
    changedFiles: input.verifiedChangedFiles ?? input.execution.changedFiles,
    pushed: true,
    failureReason: undefined,
    errorMessage: undefined,
    nowIso: now,
  });
}

export function syncTaskExecutionStateAfterGithubVerified(input: {
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly taskId: string;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): ImplementationTaskExecutionStateV1 | undefined {
  if (!input.executionState) return undefined;
  const now = input.nowIso ?? new Date().toISOString();
  const afterDevDone = markDeveloperTasksDoneForWip({
    state: input.executionState,
    cursorWorkItems: input.cursorWorkItems,
    selectedTaskId: input.taskId,
    nowIso: now,
    resultSummary: "Task Cursor GitHub commit 확인됨",
  });
  return markPostDeveloperReviewTasksQueued({
    state: afterDevDone,
    nowIso: now,
  });
}

export function syncTaskExecutionStateAfterGithubVerifyFailed(input: {
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly taskId: string;
  readonly errorMessage: string;
  readonly nowIso?: string;
}): ImplementationTaskExecutionStateV1 | undefined {
  if (!input.executionState) return undefined;
  return markDeveloperTaskFailedForTaskId({
    state: input.executionState,
    taskId: input.taskId,
    nowIso: input.nowIso,
    errorMessage: input.errorMessage,
  });
}

export function shouldSyncExecutionStateAfterTaskCursorGithubVerify(
  status: TaskCursorExecutionV1["status"],
): boolean {
  return (
    status === "github_verified" ||
    status === "review_pending" ||
    status === "security_pending" ||
    status === "scm_pending"
  );
}

export function buildTaskCursorOrchestrationPatch(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[];
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly existingCodeTaskExecutionFeedback?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly implementationExecutionJobsV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly activeCodeTaskId?: string | null;
  readonly activeWorkItemId?: string | null;
}): Readonly<{
  readonly taskCursorExecutionV1: TaskCursorExecutionV1;
  readonly taskCursorExecutionHistoryV1: readonly TaskCursorExecutionV1[];
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1;
  readonly implementationCodeTaskExecutionFeedbackV1?: ImplementationCodeTaskExecutionFeedbackV1;
  readonly implementationExecutionJobsV1?: ReturnType<typeof syncImplementationExecutionJobFromTaskCursor>;
}> {
  const selectedWorkItems = resolveSelectedWorkItemsForExecution({
    cursorWorkItems: input.cursorWorkItems,
    workItemIds: input.execution.workItemIds,
  });
  const shouldDiagnose =
    input.execution.status === "cursor_failed" ||
    input.execution.status === "github_verify_failed" ||
    input.execution.failureReason === "work_item_preflight_failed";
  const diagnosis = shouldDiagnose
    ? diagnoseImplementationCodeTaskFailure({
        failureReason: input.execution.failureReason,
        selectedWorkItems,
        codeTaskQualityGate: input.codeTaskQualityGate,
        preflightFailed: input.execution.failureReason === "work_item_preflight_failed",
        githubVerifyFailed: input.execution.status === "github_verify_failed",
      })
    : null;
  const timelineEntries = diagnosis
    ? [
        ...input.timelineEntries,
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_code_task_failure_diagnosed",
          orchestrationTraceGroup: "implementation_execution_log",
          fields: {
            projectId: input.execution.projectId,
            taskId: input.execution.taskId,
            causeLayer: diagnosis.causeLayer,
            message: diagnosis.message,
            affectedCodeTaskIds: diagnosis.affectedCodeTaskIds.join(","),
            failureReason: input.execution.failureReason ?? "",
          },
          nowIso: input.execution.updatedAt ?? new Date().toISOString(),
        }),
      ]
    : input.timelineEntries;
  const timeline = appendPromptTimelineEntries(input.existingTimeline, timelineEntries);
  const executionState =
    shouldSyncExecutionStateAfterTaskCursorGithubVerify(input.execution.status) && input.executionState
      ? syncTaskExecutionStateAfterGithubVerified({
          executionState: input.executionState,
          taskId: input.execution.taskId,
          cursorWorkItems: input.cursorWorkItems ?? [],
        })
      : input.execution.status === "github_verify_failed" && input.executionState
        ? syncTaskExecutionStateAfterGithubVerifyFailed({
            executionState: input.executionState,
            taskId: input.execution.taskId,
            errorMessage:
              input.execution.errorMessage ?? TASK_CURSOR_FAILURE_MESSAGES.github_verify_failed,
          })
        : input.executionState ?? undefined;
  const implementationCodeTaskExecutionFeedbackV1 = selectedWorkItems.length
    ? updateImplementationCodeTaskExecutionFeedback({
        projectId: input.execution.projectId,
        existing: input.existingCodeTaskExecutionFeedback,
        selectedWorkItems,
        execution: input.execution,
        diagnosis,
        nowIso: input.execution.updatedAt,
      })
    : undefined;
  const jobs = syncImplementationExecutionJobFromTaskCursor({
    jobs: parseImplementationExecutionJobsV1(input.implementationExecutionJobsV1) ?? [],
    execution: input.execution,
  });

  let codeTaskExecutionRunsV1: ReturnType<typeof syncCodeTaskExecutionRunsFromTaskCursor> | undefined;
  const codeTaskId = String(input.activeCodeTaskId ?? "").trim();
  const workItemId = String(input.activeWorkItemId ?? "").trim();
  if (codeTaskId && workItemId) {
    codeTaskExecutionRunsV1 = syncCodeTaskExecutionRunsFromTaskCursor({
      runs: parseCodeTaskExecutionRunsV1(input.codeTaskExecutionRunsV1) ?? [],
      execution: input.execution,
      codeTaskId,
      workItemId,
    });
  }

  return {
    taskCursorExecutionV1: input.execution,
    taskCursorExecutionHistoryV1: appendTaskCursorExecutionHistory(
      input.history,
      input.execution,
    ),
    promptTimeline: timeline,
    implementationExecutionJobsV1: jobs,
    ...(codeTaskExecutionRunsV1 ? { codeTaskExecutionRunsV1 } : {}),
    ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
    ...(implementationCodeTaskExecutionFeedbackV1
      ? { implementationCodeTaskExecutionFeedbackV1 }
      : {}),
  };
}

export function buildTaskCursorRequestedTimeline(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const common = {
    projectId: input.execution.projectId,
    taskId: input.execution.taskId,
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    runId: input.execution.cursorRunId,
    workItemCount: input.execution.workItemIds.length,
    nowIso: input.nowIso,
  };
  return [
    buildTaskCursorTimelineEntry({
      action: "task_cursor_execution_requested",
      status: "requested",
      ...common,
    }),
    buildTaskCursorTimelineEntry({
      action: "task_cursor_prompt_built",
      status: "prompt_ready",
      ...common,
    }),
    buildTaskCursorTimelineEntry({
      action: "task_cursor_api_requested",
      status: "cursor_requested",
      ...common,
    }),
  ];
}

export function buildTaskCursorApiStartedTimeline(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildTaskCursorTimelineEntry({
    action: "task_cursor_api_started",
    projectId: input.execution.projectId,
    taskId: input.execution.taskId,
    status: "cursor_running",
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    runId: input.execution.cursorRunId,
    workItemCount: input.execution.workItemIds.length,
    nowIso: input.nowIso,
  });
}

export function buildTaskCursorApiCompletedTimeline(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildTaskCursorTimelineEntry({
    action: "task_cursor_api_completed",
    projectId: input.execution.projectId,
    taskId: input.execution.taskId,
    status: "cursor_completed",
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    commitSha: input.execution.commitSha,
    changedFileCount: input.execution.changedFiles?.length ?? 0,
    runId: input.execution.cursorRunId,
    nowIso: input.nowIso,
  });
}

export function buildTaskCursorApiFailedTimeline(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildTaskCursorTimelineEntry({
    action: "task_cursor_api_failed",
    projectId: input.execution.projectId,
    taskId: input.execution.taskId,
    status: "cursor_failed",
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    reason: input.execution.failureReason,
    runId: input.execution.cursorRunId,
    nowIso: input.nowIso,
  });
}

export function buildTaskCursorPollCancelledOrchestrationPatch(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const stopped = patchTaskCursorExecution(input.execution, {
    status: "status_check_stopped",
    failureReason: undefined,
    errorMessage: TASK_CURSOR_POLL_CANCELLED_MESSAGE,
    nowIso,
  });
  return buildTaskCursorOrchestrationPatch({
    execution: stopped,
    history: input.history,
    timelineEntries: [
      buildTaskCursorPollLifecycleTimelineEntry({
        action: "task_cursor_poll_cancelled",
        projectId: stopped.projectId,
        taskId: stopped.taskId,
        runId: stopped.cursorRunId,
        executionStatus: "status_check_stopped",
        message: TASK_CURSOR_POLL_CANCELLED_MESSAGE,
        nowIso,
      }),
    ],
    existingTimeline: input.existingTimeline,
  });
}

export function buildTaskCursorPollResumeOrchestrationPatch(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const resumed = patchTaskCursorExecution(input.execution, {
    status: "cursor_running",
    failureReason: undefined,
    errorMessage: undefined,
    nowIso,
  });
  return buildTaskCursorOrchestrationPatch({
    execution: resumed,
    history: input.history,
    timelineEntries: [
      buildTaskCursorPollLifecycleTimelineEntry({
        action: "task_cursor_poll_resumed",
        projectId: resumed.projectId,
        taskId: resumed.taskId,
        runId: resumed.cursorRunId,
        executionStatus: "cursor_running",
        message: "Cloud Agent 상태 확인을 다시 시작합니다.",
        nowIso,
      }),
    ],
    existingTimeline: input.existingTimeline,
  });
}

export function buildTaskCursorFailedOrchestrationPatch(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly message: string;
  readonly reason?: TaskCursorFailureReason;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
  readonly cursorWorkItems?: readonly CursorWorkItem[];
  readonly existingCodeTaskExecutionFeedback?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const failed = patchTaskCursorExecution(input.execution, {
    status: "cursor_failed",
    failureReason: input.reason ?? "unknown",
    errorMessage: input.message,
    nowIso,
  });
  return buildTaskCursorOrchestrationPatch({
    execution: failed,
    history: input.history,
    timelineEntries: [buildTaskCursorApiFailedTimeline({ execution: failed, nowIso })],
    existingTimeline: input.existingTimeline,
    cursorWorkItems: input.cursorWorkItems,
    existingCodeTaskExecutionFeedback: input.existingCodeTaskExecutionFeedback,
    codeTaskQualityGate: input.codeTaskQualityGate,
  });
}

export function buildTaskCursorGithubVerifyTimeline(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly ok: boolean;
  readonly reason?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildTaskCursorTimelineEntry({
    action: input.ok ? "task_cursor_github_verified" : "task_cursor_github_verify_failed",
    projectId: input.execution.projectId,
    taskId: input.execution.taskId,
    status: input.ok ? "github_verified" : "github_verify_failed",
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    commitSha: input.execution.commitSha,
    changedFileCount: input.execution.changedFiles?.length ?? 0,
    reason: input.reason,
    runId: input.execution.cursorRunId,
    nowIso: input.nowIso,
  });
}
