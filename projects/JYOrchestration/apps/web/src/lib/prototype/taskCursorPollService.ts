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
  parseGithubProgressLastCheckMs,
  resolveEffectiveGithubLaunchMs,
  resolveGithubProgressNextPollDelayMs,
  shouldRunTaskCursorGithubProgressVerify,
  TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { isTransientTaskCursorGithubVerifyMiss } from "@/lib/prototype/taskCursorGithubVerify";
import { buildTaskCursorRuntimeSyncTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
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

  const nowMs = Date.parse(nowIso);
  const resolveRunningNextPollDelayMs = (exec: TaskCursorExecutionV1) =>
    resolveGithubProgressNextPollDelayMs({
      launchMs: resolveEffectiveGithubLaunchMs({ execution: exec }),
      lastCheckMs: parseGithubProgressLastCheckMs(exec),
      nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
    });

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
