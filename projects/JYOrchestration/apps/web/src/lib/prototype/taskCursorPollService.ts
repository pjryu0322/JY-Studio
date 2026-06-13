import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
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
import { applyGithubVerifyStuckEscalationIfNeeded } from "@/lib/prototype/taskCursorGithubVerifyEscalation";
import {
  verifyTaskCursorGithubResult,
  type TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  isCursorCloudAgentRunId,
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import {
  isGithubProgressPollDue,
  parseGithubProgressLastCheckMs,
  resolveEffectiveGithubLaunchMs,
  resolveGithubProgressNextPollDelayMs,
  shouldRunTaskCursorGithubProgressVerify,
  TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { isTransientTaskCursorGithubVerifyMiss } from "@/lib/prototype/taskCursorGithubVerify";
import { buildTaskCursorRuntimeSyncTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  buildImplementationExecutionUnitGithubPollTimelineEntry,
  CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
  CODE_TASK_GITHUB_POLL_INTERVAL_MS,
} from "@/lib/prototype/implementationGithubPollingScheduler";
import { isTerminalTaskCursorPollResultStatus } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type TaskCursorPollOnceResult = Readonly<{
  readonly success: boolean;
  readonly status: string;
  readonly message?: string;
  readonly agentStatus?: string;
  readonly execution: TaskCursorExecutionV1;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly terminal: boolean;
  readonly nextPollDelayMs?: number;
  readonly githubVerifyResult?: TaskCursorGithubVerifyResult | null;
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

function repoFullNameFromContext(targetRepository: ProjectTargetRepository): string {
  const owner = String(targetRepository.owner ?? "").trim();
  const repo = String(targetRepository.repo ?? "").trim();
  return owner && repo ? `${owner}/${repo}` : "";
}

async function pollCodeTaskGithubProgressOnce(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly nowIso: string;
  readonly nowMs: number;
  readonly context: TaskCursorPollRuntimeContext;
  readonly buildPatch: (
    nextExecution: TaskCursorExecutionV1,
    timelineEntries: readonly RequirementsPromptTimelineEntry[],
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly resolveRunningNextPollDelayMs: (exec: TaskCursorExecutionV1) => number;
}): Promise<TaskCursorPollOnceResult> {
  const { projectId, codeTaskId, execution, nowIso, nowMs, context, buildPatch, resolveRunningNextPollDelayMs } =
    input;
  const processTaskId = execution.taskId;
  const targetRepository =
    repoFullNameFromContext(context.targetRepository) || String(execution.targetRepository ?? "");
  const baseBranch = execution.baseBranch ?? context.baseBranch;
  const workBranch = String(execution.workBranch ?? "").trim();
  const launchMs = resolveEffectiveGithubLaunchMs({ execution });
  const lastCheckMs = parseGithubProgressLastCheckMs(execution);
  const elapsedMs = launchMs != null ? Math.max(0, nowMs - launchMs) : undefined;

  const unitTimelineBase = {
    projectId,
    codeTaskId,
    processTaskId,
    targetRepository,
    baseBranch,
    workBranch,
    firstPollDelayMs: CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
    pollIntervalMs: CODE_TASK_GITHUB_POLL_INTERVAL_MS,
    elapsedMs,
    nowIso,
  };

  if (isTerminalTaskCursorPollResultStatus(execution.status)) {
    return {
      success: execution.status === "github_verified" || execution.status === "review_pending",
      status: execution.status,
      execution,
      orchestrationPatch: buildPatch(execution, []),
      terminal: true,
    };
  }

  if (
    execution.status !== "cursor_running" &&
    execution.status !== "cursor_requested" &&
    execution.status !== "github_verifying"
  ) {
    const nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });
    return {
      success: true,
      status: nextExecution.status,
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, []),
      terminal: false,
      nextPollDelayMs: resolveRunningNextPollDelayMs(nextExecution),
    };
  }

  if (!isGithubProgressPollDue({ launchMs, lastCheckMs, nowMs })) {
    const timeline = [
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...unitTimelineBase,
        action: "implementation_execution_unit_github_poll_waiting",
      }),
    ];
    return {
      success: true,
      status: execution.status,
      execution,
      orchestrationPatch: buildPatch(execution, timeline),
      terminal: false,
      nextPollDelayMs: resolveGithubProgressNextPollDelayMs({ launchMs, lastCheckMs, nowMs }),
    };
  }

  const githubOnlyTimeline: RequirementsPromptTimelineEntry[] = [
    buildImplementationExecutionUnitGithubPollTimelineEntry({
      ...unitTimelineBase,
      action: "implementation_execution_unit_github_poll_started",
    }),
    buildImplementationExecutionUnitGithubPollTimelineEntry({
      ...unitTimelineBase,
      action: "implementation_execution_unit_github_branch_lookup_requested",
    }),
  ];

  let nextExecution = patchTaskCursorExecution(execution, {
    githubProgressLastCheckAt: nowIso,
    status: execution.status === "cursor_requested" ? "cursor_running" : execution.status,
    nowIso,
  });

  githubOnlyTimeline.push(
    buildTaskCursorRuntimeSyncTimelineEntry({
      action: "task_cursor_github_verify_requested",
      projectId,
      taskId: processTaskId,
      codeTaskId,
      nowIso,
    }),
  );

  const verify = await verifyTaskCursorGithubResult({
    execution: nextExecution,
    targetRepository: context.targetRepository,
    githubToken: context.githubToken,
    allowedPathGlobs: context.allowedPathGlobs,
    codeTaskId,
  });

  if (verify.ok && verify.verifiedCommitSha) {
    githubOnlyTimeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...unitTimelineBase,
        action: "implementation_execution_unit_github_head_commit_resolved",
        branchHeadCommit: verify.verifiedCommitSha,
      }),
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...unitTimelineBase,
        action: "implementation_execution_unit_github_verify_passed",
        branchHeadCommit: verify.verifiedCommitSha,
      }),
    );
  } else if (isTransientTaskCursorGithubVerifyMiss(verify)) {
    githubOnlyTimeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...unitTimelineBase,
        action: "implementation_execution_unit_github_branch_missing_retry_scheduled",
        errorCode: verify.reason ?? verify.uiReason ?? "github_branch_missing",
        errorMessage: verify.message,
      }),
    );
  } else {
    const timeoutLike =
      verify.reason === "github_verify_timeout" || verify.detailReason === "github_verify_timeout";
    githubOnlyTimeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...unitTimelineBase,
        action: timeoutLike
          ? "implementation_execution_unit_github_verify_timeout"
          : "implementation_execution_unit_github_verify_failed",
        errorCode: verify.reason ?? verify.detailReason ?? undefined,
        errorMessage: verify.message,
      }),
    );
  }

  githubOnlyTimeline.push(
    buildTaskCursorRuntimeSyncTimelineEntry({
      action: verify.ok ? "task_cursor_github_verify_completed" : "task_cursor_github_verify_failed",
      projectId,
      taskId: processTaskId,
      codeTaskId,
      message: verify.ok ? "ok" : verify.reason ?? verify.message,
      nowIso,
    }),
  );

  nextExecution = applyTaskCursorGithubVerifyResult({
    execution: nextExecution,
    ok: verify.ok,
    message: verify.message,
    reason: verify.reason,
    detailReason: verify.detailReason,
    verifiedChangedFiles: verify.verifiedChangedFiles,
    verifiedCommitSha: verify.verifiedCommitSha,
    nowIso,
  });

  const escalation = applyGithubVerifyStuckEscalationIfNeeded({
    execution: nextExecution,
    verifyDetailReason: verify.detailReason,
    codeTaskId,
    nowIso,
  });
  nextExecution = escalation.execution;
  if (escalation.timelineEntry) {
    githubOnlyTimeline.push(escalation.timelineEntry);
  }

  if (verify.ok && nextExecution.status === "github_verified") {
    nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
  }

  githubOnlyTimeline.push(
    buildTaskCursorGithubVerifyTimeline({
      execution: nextExecution,
      ok: verify.ok,
      reason: verify.reason,
      nowIso,
    }),
  );

  const status = nextExecution.status;
  return {
    success: verify.ok,
    status,
    execution: nextExecution,
    orchestrationPatch: buildPatch(nextExecution, githubOnlyTimeline),
    terminal: isTerminalTaskCursorPollResultStatus(status),
    nextPollDelayMs: isTerminalTaskCursorPollResultStatus(status)
      ? undefined
      : resolveRunningNextPollDelayMs(nextExecution),
    githubVerifyResult: verify,
  };
}

export async function pollTaskCursorExecutionOnce(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly codeTaskId?: string | null;
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
  const nowMs = Date.parse(nowIso);
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

  const codeTaskId = input.codeTaskId?.trim() ?? "";
  const codeTaskGithubOnly =
    Boolean(codeTaskId) && input.verifyGithub !== false && Boolean(input.context.githubToken?.trim());

  const resolveRunningNextPollDelayMs = (exec: TaskCursorExecutionV1) =>
    resolveGithubProgressNextPollDelayMs({
      launchMs: resolveEffectiveGithubLaunchMs({ execution: exec }),
      lastCheckMs: parseGithubProgressLastCheckMs(exec),
      nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
    });

  if (codeTaskGithubOnly) {
    const branch = String(execution.workBranch ?? "").trim();
    if (!branch) {
      const nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });
      return {
        success: false,
        status: "poll_not_ready",
        message: "workBranch가 없어 GitHub polling을 시작할 수 없습니다.",
        execution: nextExecution,
        orchestrationPatch: buildPatch(nextExecution, []),
        terminal: false,
        nextPollDelayMs: CODE_TASK_GITHUB_POLL_INTERVAL_MS,
      };
    }
    return pollCodeTaskGithubProgressOnce({
      projectId,
      codeTaskId,
      execution,
      nowIso,
      nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
      context: input.context,
      buildPatch,
      resolveRunningNextPollDelayMs,
    });
  }

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

  if (
    execution.status === "github_verifying" &&
    input.verifyGithub !== false &&
    input.context.githubToken &&
    shouldRunTaskCursorGithubProgressVerify({ execution })
  ) {
    const githubOnlyTimeline: RequirementsPromptTimelineEntry[] = [];
    let nextExecution = patchTaskCursorExecution(execution, {
      githubProgressLastCheckAt: nowIso,
      nowIso,
    });
    githubOnlyTimeline.push(
      buildTaskCursorRuntimeSyncTimelineEntry({
        action: "task_cursor_github_verify_requested",
        projectId,
        taskId: execution.taskId,
        nowIso,
      }),
    );
    const verify = await verifyTaskCursorGithubResult({
      execution: nextExecution,
      targetRepository: input.context.targetRepository,
      githubToken: input.context.githubToken,
      allowedPathGlobs: input.context.allowedPathGlobs,
      codeTaskId: input.codeTaskId,
    });
    githubOnlyTimeline.push(
      buildTaskCursorRuntimeSyncTimelineEntry({
        action: verify.ok
          ? "task_cursor_github_verify_completed"
          : "task_cursor_github_verify_failed",
        projectId,
        taskId: execution.taskId,
        message: verify.ok ? "ok" : verify.reason ?? verify.message,
        nowIso,
      }),
    );
    nextExecution = applyTaskCursorGithubVerifyResult({
      execution: nextExecution,
      ok: verify.ok,
      message: verify.message,
      reason: verify.reason,
      detailReason: verify.detailReason,
      verifiedChangedFiles: verify.verifiedChangedFiles,
      verifiedCommitSha: verify.verifiedCommitSha,
      nowIso,
    });
    const escalation = applyGithubVerifyStuckEscalationIfNeeded({
      execution: nextExecution,
      verifyDetailReason: verify.detailReason,
      codeTaskId: input.codeTaskId,
      nowIso,
    });
    nextExecution = escalation.execution;
    if (escalation.timelineEntry) {
      githubOnlyTimeline.push(escalation.timelineEntry);
    }
    if (verify.ok && nextExecution.status === "github_verified") {
      nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
    }
    githubOnlyTimeline.push(
      buildTaskCursorGithubVerifyTimeline({
        execution: nextExecution,
        ok: verify.ok,
        reason: verify.reason,
        nowIso,
      }),
    );
    const status = nextExecution.status;
    return {
      success: verify.ok,
      status,
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, githubOnlyTimeline),
      terminal: isTerminalTaskCursorPollResultStatus(status),
      nextPollDelayMs: isTerminalTaskCursorPollResultStatus(status)
        ? undefined
        : resolveRunningNextPollDelayMs(nextExecution),
      githubVerifyResult: verify,
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

    const agentStatus = pollStep.statusUpper;
    const runGithubProgressVerify =
      input.verifyGithub !== false &&
      input.context.githubToken &&
      shouldRunTaskCursorGithubProgressVerify({
        execution: nextExecution,
      });

    if (runGithubProgressVerify) {
      nextExecution = patchTaskCursorExecution(nextExecution, {
        githubProgressLastCheckAt: nowIso,
        nowIso,
      });
      timeline.push(
        buildTaskCursorRuntimeSyncTimelineEntry({
          action: "task_cursor_github_verify_requested",
          projectId,
          taskId: execution.taskId,
          nowIso,
        }),
      );
      const verify = await verifyTaskCursorGithubResult({
        execution: nextExecution,
        targetRepository: input.context.targetRepository,
        githubToken: input.context.githubToken,
        allowedPathGlobs: input.context.allowedPathGlobs,
        codeTaskId: input.codeTaskId,
      });
      timeline.push(
        buildTaskCursorRuntimeSyncTimelineEntry({
          action: verify.ok
            ? "task_cursor_github_verify_completed"
            : "task_cursor_github_verify_failed",
          projectId,
          taskId: execution.taskId,
          message: verify.ok ? "ok" : verify.reason ?? verify.message,
          nowIso,
        }),
      );
      if (verify.ok) {
        nextExecution = patchTaskCursorExecution(nextExecution, {
          status: "github_verifying",
          commitSha: verify.verifiedCommitSha,
          nowIso,
        });
        nextExecution = applyTaskCursorGithubVerifyResult({
          execution: nextExecution,
          ok: true,
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
            ok: true,
            reason: verify.reason,
            nowIso,
          }),
        );
        const status = nextExecution.status;
        return {
          success: true,
          status,
          agentStatus,
          execution: nextExecution,
          orchestrationPatch: buildPatch(nextExecution, timeline),
          terminal: isTerminalTaskCursorPollResultStatus(status),
          nextPollDelayMs: isTerminalTaskCursorPollResultStatus(status)
            ? undefined
            : TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
          githubVerifyResult: verify,
        };
      }
      if (isTransientTaskCursorGithubVerifyMiss(verify)) {
        nextExecution = applyTaskCursorGithubVerifyResult({
          execution: nextExecution,
          ok: false,
          message: verify.message,
          reason: verify.reason,
          detailReason: verify.detailReason,
          nowIso,
        });
        return {
          success: true,
          status: nextExecution.status,
          agentStatus,
          execution: nextExecution,
          orchestrationPatch: buildPatch(nextExecution, timeline),
          terminal: false,
          nextPollDelayMs: resolveRunningNextPollDelayMs(nextExecution),
          githubVerifyResult: verify,
        };
      }
    }

    return {
      success: true,
      status: nextExecution.status,
      agentStatus: pollStep.statusUpper,
      execution: nextExecution,
      orchestrationPatch: buildPatch(nextExecution, timeline),
      terminal: false,
      nextPollDelayMs: resolveRunningNextPollDelayMs(nextExecution),
    };
  }

  if (pollStep.kind === "failed") {
    const branch = String(execution.workBranch ?? "").trim();
    const canRecoverViaGithub =
      pollStep.reason === "commit_not_created" &&
      branch &&
      input.verifyGithub !== false &&
      Boolean(input.context.githubToken);

    if (canRecoverViaGithub) {
      timeline.push(
        buildTaskCursorRuntimeSyncTimelineEntry({
          action: "task_cursor_github_fallback_verify_started",
          projectId,
          taskId: execution.taskId,
          nowIso,
        }),
      );
      const verify = await verifyTaskCursorGithubResult({
        execution: patchTaskCursorExecution(execution, { status: "cursor_running", workBranch: branch, nowIso }),
        targetRepository: input.context.targetRepository,
        githubToken: input.context.githubToken,
        allowedPathGlobs: input.context.allowedPathGlobs,
        codeTaskId: input.codeTaskId,
      });
      timeline.push(
        buildTaskCursorRuntimeSyncTimelineEntry({
          action: "task_cursor_github_fallback_verify_completed",
          projectId,
          taskId: execution.taskId,
          message: verify.ok ? "ok" : verify.reason ?? verify.message,
          nowIso,
        }),
      );
      if (verify.ok) {
        nextExecution = patchTaskCursorExecution(execution, {
          status: "github_verifying",
          commitSha: verify.verifiedCommitSha,
          nowIso,
        });
        nextExecution = applyTaskCursorGithubVerifyResult({
          execution: nextExecution,
          ok: true,
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
            ok: true,
            reason: verify.reason,
            nowIso,
          }),
        );
        const status = nextExecution.status;
        return {
          success: true,
          status,
          message: pollStep.message,
          execution: nextExecution,
          orchestrationPatch: buildPatch(nextExecution, timeline),
          terminal: isTerminalTaskCursorPollResultStatus(status),
          nextPollDelayMs: isTerminalTaskCursorPollResultStatus(status) ? undefined : 10_000,
          githubVerifyResult: verify,
        };
      }
    }

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

  let githubVerifyResult: TaskCursorGithubVerifyResult | null = null;
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
      codeTaskId: input.codeTaskId,
    });
    githubVerifyResult = verify;
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
    ...(githubVerifyResult ? { githubVerifyResult } : {}),
  };
}
