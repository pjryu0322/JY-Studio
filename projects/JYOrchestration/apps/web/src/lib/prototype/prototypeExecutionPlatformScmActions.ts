import {
  applyPlatformScmPushFailureToWip,
  applyPlatformScmPushSuccessToWip,
  applyPlatformScmMergeFailureToWip,
  applyPlatformScmMergePendingToWip,
  applyPlatformScmMergeSuccessToWip,
  type PlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildPlatformScmTimelineEntry } from "@/lib/prototype/targetRepoE2eDiagnostics";
import type { PlatformScmPushExecutorResult } from "@/lib/prototype/platformScmPushExecutor";
import type { PlatformScmMergeExecutorResult } from "@/lib/prototype/platformScmMergeExecutor";
import {
  resolvePlatformScmWipContext,
  type PlatformScmWipContext,
} from "@/lib/prototype/platformScmWipContext";
import {
  buildPrototypeOrchestrationResult,
  type PrototypeOrchestrationResult,
} from "@/lib/prototype/prototypeOrchestrationResult";
import {
  markIntegratedStepDone,
  markIntegratedStepFailed,
  type ImplementationIntegratedExecutionStateV1,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  markRoleTasksDone,
  markRoleTasksFailed,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";

export type PlatformScmOrchestrationResult = PrototypeOrchestrationResult;

function buildScmTimelineEntry(input: {
  readonly ctx: PlatformScmWipContext;
  readonly action: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly prNumber?: number;
  readonly status: string;
  readonly reason?: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return buildPlatformScmTimelineEntry({
    action: input.action,
    projectId: input.ctx.projectId,
    selectedTaskId: input.ctx.taskId,
    repoFullName: input.ctx.repoFullName,
    branchName: input.branchName ?? input.ctx.branchName,
    commitSha: input.commitSha ?? input.ctx.commitSha,
    prNumber: input.prNumber,
    status: input.status,
    reason: input.reason,
    nowIso: input.nowIso,
  });
}

function buildPlatformScmCompletedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly message: string;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("memo");
  return newRequirementsMessage({
    id: `platform-scm-completed-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "memo",
    speakerName: def?.title ?? "SCM",
    messageType: "STATEMENT",
    content: [
      "플랫폼 SCM push/PR 반영이 완료되었습니다.",
      "",
      input.message,
      "",
      "Repository:",
      `- ${input.scm.targetRepository || input.wip.targetRepoFullName || "(미기록)"}`,
      "",
      "Branch:",
      `- ${input.scm.sourceBranchName}`,
      "",
      "Commit:",
      `- ${input.scm.sourceCommitSha.slice(0, 12)}`,
      ...(input.scm.prNumber !== undefined
        ? ["", "Pull Request:", `- #${input.scm.prNumber}${input.scm.prUrl ? ` — ${input.scm.prUrl}` : ""}`]
        : []),
    ].join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: "PLATFORM_SCM_COMPLETED_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

function buildPlatformScmStatementMessage(input: {
  readonly idPrefix: string;
  readonly content: string;
  readonly internalType: string;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("memo");
  return newRequirementsMessage({
    id: `${input.idPrefix}-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "memo",
    speakerName: def?.title ?? "SCM",
    messageType: "STATEMENT",
    content: input.content,
    createdAt: input.nowIso,
    meta: {
      internalType: input.internalType,
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

function buildPlatformScmFailedMessage(input: {
  readonly message: string;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildPlatformScmStatementMessage({
    idPrefix: "platform-scm-failed",
    internalType: "PLATFORM_SCM_FAILED_V1",
    nowIso: input.nowIso,
    content: ["플랫폼 SCM push/PR 반영에 실패했습니다.", "", "사유:", `- ${input.message}`].join("\n"),
  });
}

export function buildPlatformScmOrchestrationResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly executorResult: PlatformScmPushExecutorResult;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): PlatformScmOrchestrationResult {
  const now = input.nowIso ?? new Date().toISOString();
  const ctx = resolvePlatformScmWipContext(input.wip);

  if (input.executorResult.status === "blocked") {
    return buildPrototypeOrchestrationResult({
      kind: "blocked",
      message: input.executorResult.message,
      requirementsStateJson: input.requirementsStateJson,
      newMessages: [buildPlatformScmFailedMessage({ message: input.executorResult.message, nowIso: now })],
      orchestrationPatch: {
        codeAgentWipExecutionV1: input.wip,
        promptTimeline: appendPromptTimeline(
          input.promptTimeline,
          buildScmTimelineEntry({
            ctx,
            action: "platform_scm_push_failed",
            status: "blocked",
            reason: input.executorResult.message,
            nowIso: now,
          }),
        ),
      },
    });
  }

  const scm = input.executorResult.platformScmExecutionV1;
  if (!input.executorResult.ok || !scm) {
    const failedWip = scm
      ? applyPlatformScmPushFailureToWip({
          wip: input.wip,
          scm,
          errorMessage: input.executorResult.message,
          nowIso: now,
        })
      : input.wip;
    return buildPrototypeOrchestrationResult({
      kind: "failed",
      message: input.executorResult.message,
      requirementsStateJson: input.requirementsStateJson,
      newMessages: [buildPlatformScmFailedMessage({ message: input.executorResult.message, nowIso: now })],
      orchestrationPatch: {
        codeAgentWipExecutionV1: failedWip,
        promptTimeline: appendPromptTimeline(
          input.promptTimeline,
          buildScmTimelineEntry({
            ctx,
            action: "platform_scm_push_failed",
            status: "failed",
            reason: input.executorResult.message,
            nowIso: now,
          }),
        ),
      },
    });
  }

  const updatedWip = applyPlatformScmPushSuccessToWip({
    wip: input.wip,
    scm,
    prNumber: input.executorResult.prNumber,
    prUrl: input.executorResult.prUrl,
    nowIso: now,
  });

  let timeline = appendPromptTimeline(
    input.promptTimeline,
    buildScmTimelineEntry({
      ctx,
      action: "platform_scm_push_started",
      branchName: scm.sourceBranchName,
      commitSha: scm.sourceCommitSha,
      status: "running",
      nowIso: now,
    }),
  );
  timeline = appendPromptTimeline(
    timeline,
    buildScmTimelineEntry({
      ctx,
      action: "platform_scm_push_completed",
      branchName: scm.sourceBranchName,
      commitSha: scm.sourceCommitSha,
      status: "completed",
      nowIso: now,
    }),
  );
  if (input.executorResult.prNumber !== undefined) {
    timeline = appendPromptTimeline(
      timeline,
      buildScmTimelineEntry({
        ctx,
        action: "platform_scm_pr_created",
        branchName: scm.sourceBranchName,
        commitSha: scm.sourceCommitSha,
        prNumber: input.executorResult.prNumber,
        status: "completed",
        nowIso: now,
      }),
    );
  }

  return buildPrototypeOrchestrationResult({
    kind: "completed",
    message: input.executorResult.message,
    requirementsStateJson: input.requirementsStateJson,
    newMessages: [
      buildPlatformScmCompletedMessage({
        wip: updatedWip,
        scm: updatedWip.platformScmExecutionV1 ?? scm,
        message: input.executorResult.message,
        nowIso: now,
      }),
    ],
    orchestrationPatch: {
      codeAgentWipExecutionV1: updatedWip,
      promptTimeline: timeline,
    },
  });
}

export function buildPlatformScmExecutionPersistPatch(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly executorResult: PlatformScmPushExecutorResult;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly projectId: string;
  readonly taskRowsCompleted?: boolean;
  readonly finalizeIntegratedFinalScm?: boolean;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestration: PlatformScmOrchestrationResult;
  readonly executionState?: ImplementationTaskExecutionStateV1;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1;
}> {
  const orchestration = buildPlatformScmOrchestrationResult({
    requirementsStateJson: input.requirementsStateJson,
    wip: input.wip,
    executorResult: input.executorResult,
    promptTimeline: input.promptTimeline,
    nowIso: input.nowIso,
  });

  let executionState = input.executionState ?? undefined;
  if (executionState) {
    if (orchestration.kind === "completed") {
      executionState = markRoleTasksDone({
        state: executionState,
        ownerRole: "scm",
        resultSummary: orchestration.message,
        nowIso: input.nowIso,
      });
    } else if (orchestration.kind === "failed") {
      executionState = markRoleTasksFailed({
        state: executionState,
        ownerRole: "scm",
        errorMessage: orchestration.message,
        resultSummary: orchestration.message,
        nowIso: input.nowIso,
      });
    }
  }

  let integratedExecutionState = input.integratedExecutionState ?? undefined;
  if (input.finalizeIntegratedFinalScm && integratedExecutionState) {
    if (orchestration.kind === "completed") {
      integratedExecutionState = markIntegratedStepDone({
        state: integratedExecutionState,
        projectId: input.projectId,
        step: "final_scm",
        taskRowsCompleted: input.taskRowsCompleted,
        resultSummary: orchestration.message,
        nowIso: input.nowIso,
      });
    } else if (orchestration.kind === "failed" || orchestration.kind === "blocked") {
      integratedExecutionState = markIntegratedStepFailed({
        state: integratedExecutionState,
        projectId: input.projectId,
        step: "final_scm",
        errorMessage: orchestration.message,
        resultSummary: orchestration.message,
        nowIso: input.nowIso,
      });
    }
  }

  return {
    orchestration,
    ...(executionState ? { executionState } : {}),
    ...(integratedExecutionState ? { integratedExecutionState } : {}),
  };
}

function buildPlatformScmMergeCompletedMessage(input: {
  readonly scm: PlatformScmExecutionV1;
  readonly message: string;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildPlatformScmStatementMessage({
    idPrefix: "platform-scm-merge-completed",
    internalType: "PLATFORM_SCM_MERGE_COMPLETED_V1",
    nowIso: input.nowIso,
    content: [
      "플랫폼 SCM PR merge가 완료되었습니다.",
      "",
      input.message,
      "",
      ...(input.scm.prNumber !== undefined
        ? [`Pull Request: #${input.scm.prNumber}${input.scm.prUrl ? ` — ${input.scm.prUrl}` : ""}`]
        : []),
    ].join("\n"),
  });
}

function buildPlatformScmMergePendingMessage(input: {
  readonly message: string;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildPlatformScmStatementMessage({
    idPrefix: "platform-scm-merge-pending",
    internalType: "PLATFORM_SCM_MERGE_PENDING_V1",
    nowIso: input.nowIso,
    content: ["플랫폼 SCM PR merge가 대기 중입니다.", "", input.message].join("\n"),
  });
}

function buildPlatformScmMergeFailedMessage(input: {
  readonly message: string;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildPlatformScmStatementMessage({
    idPrefix: "platform-scm-merge-failed",
    internalType: "PLATFORM_SCM_MERGE_FAILED_V1",
    nowIso: input.nowIso,
    content: ["플랫폼 SCM PR merge에 실패했습니다.", "", "사유:", `- ${input.message}`].join("\n"),
  });
}

export function buildPlatformScmMergeOrchestrationResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly executorResult: PlatformScmMergeExecutorResult;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): PlatformScmOrchestrationResult {
  const now = input.nowIso ?? new Date().toISOString();
  const ctx = resolvePlatformScmWipContext(input.wip);
  const scm = input.executorResult.platformScmExecutionV1;
  let timeline = input.promptTimeline ?? [];

  if (input.executorResult.diffGate) {
    timeline = appendPromptTimeline(
      timeline,
      buildScmTimelineEntry({
        ctx,
        action:
          input.executorResult.diffGate.ok
            ? "platform_scm_diff_gate_validated"
            : "platform_scm_diff_gate_failed",
        branchName: scm?.sourceBranchName,
        commitSha: scm?.sourceCommitSha,
        prNumber: scm?.prNumber,
        status: input.executorResult.diffGate.status,
        reason: input.executorResult.diffGate.message,
        nowIso: now,
      }),
    );
  }

  if (input.executorResult.status === "blocked") {
    return buildPrototypeOrchestrationResult({
      kind: "blocked",
      message: input.executorResult.message,
      requirementsStateJson: input.requirementsStateJson,
      newMessages: [buildPlatformScmMergeFailedMessage({ message: input.executorResult.message, nowIso: now })],
      orchestrationPatch: {
        codeAgentWipExecutionV1: input.wip,
        promptTimeline: timeline,
      },
    });
  }

  if (!input.executorResult.ok || !scm) {
    const failedWip = scm
      ? applyPlatformScmMergeFailureToWip({
          wip: input.wip,
          scm,
          errorMessage: input.executorResult.message,
          nowIso: now,
        })
      : input.wip;
    timeline = appendPromptTimeline(
      timeline,
      buildScmTimelineEntry({
        ctx,
        action: "platform_scm_merge_failed",
        branchName: scm?.sourceBranchName,
        commitSha: scm?.sourceCommitSha,
        prNumber: scm?.prNumber,
        status: "failed",
        reason: input.executorResult.message,
        nowIso: now,
      }),
    );
    return buildPrototypeOrchestrationResult({
      kind: "failed",
      message: input.executorResult.message,
      requirementsStateJson: input.requirementsStateJson,
      newMessages: [buildPlatformScmMergeFailedMessage({ message: input.executorResult.message, nowIso: now })],
      orchestrationPatch: {
        codeAgentWipExecutionV1: failedWip,
        promptTimeline: timeline,
      },
    });
  }

  timeline = appendPromptTimeline(
    timeline,
    buildScmTimelineEntry({
      ctx,
      action: "platform_scm_merge_requested",
      branchName: scm.sourceBranchName,
      commitSha: scm.sourceCommitSha,
      prNumber: scm.prNumber,
      status: input.executorResult.merged ? "running" : "pending",
      nowIso: now,
    }),
  );

  const updatedWip =
    input.executorResult.status === "pending"
      ? applyPlatformScmMergePendingToWip({ wip: input.wip, scm, nowIso: now })
      : applyPlatformScmMergeSuccessToWip({ wip: input.wip, scm, nowIso: now });

  if (input.executorResult.merged) {
    timeline = appendPromptTimeline(
      timeline,
      buildScmTimelineEntry({
        ctx,
        action: "platform_scm_merge_completed",
        branchName: scm.sourceBranchName,
        commitSha: scm.sourceCommitSha,
        prNumber: scm.prNumber,
        status: "completed",
        nowIso: now,
      }),
    );
  }

  const completedMessage =
    input.executorResult.status === "pending"
      ? buildPlatformScmMergePendingMessage({ message: input.executorResult.message, nowIso: now })
      : buildPlatformScmMergeCompletedMessage({
          scm: updatedWip.platformScmExecutionV1 ?? scm,
          message: input.executorResult.message,
          nowIso: now,
        });

  return buildPrototypeOrchestrationResult({
    kind: "completed",
    message: input.executorResult.message,
    requirementsStateJson: input.requirementsStateJson,
    newMessages: [completedMessage],
    orchestrationPatch: {
      codeAgentWipExecutionV1: updatedWip,
      promptTimeline: timeline,
    },
  });
}

export function buildPlatformScmMergePersistPatch(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly executorResult: PlatformScmMergeExecutorResult;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestration: PlatformScmOrchestrationResult;
  readonly executionState?: ImplementationTaskExecutionStateV1;
}> {
  const orchestration = buildPlatformScmMergeOrchestrationResult({
    requirementsStateJson: input.requirementsStateJson,
    wip: input.wip,
    executorResult: input.executorResult,
    promptTimeline: input.promptTimeline,
    nowIso: input.nowIso,
  });

  let executionState = input.executionState ?? undefined;
  if (executionState && orchestration.kind === "completed" && input.executorResult.merged) {
    executionState = markRoleTasksDone({
      state: executionState,
      ownerRole: "scm",
      resultSummary: orchestration.message,
      nowIso: input.nowIso,
    });
  } else if (executionState && orchestration.kind === "failed") {
    executionState = markRoleTasksFailed({
      state: executionState,
      ownerRole: "scm",
      errorMessage: orchestration.message,
      resultSummary: orchestration.message,
      nowIso: input.nowIso,
    });
  }

  return {
    orchestration,
    ...(executionState ? { executionState } : {}),
  };
}
