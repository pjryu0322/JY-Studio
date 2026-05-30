import {
  buildCodeAgentWipBridgeCompletedMessage,
  buildCodeAgentWipTimelineEntry,
  type CodeAgentWipCommit,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { CursorBridgeExecuteRequest, CursorBridgeExecuteResult } from "@/lib/prototype/cursorBridgeExecution";
import { bridgeResultValidationContextFromRequest } from "@/lib/prototype/cursorBridgeExecution";
import {
  bridgeValidationContextFromWip,
  evaluateBridgeResultEligibleForCompletion,
  formatBridgeSourceGenerationRejectionMessage,
} from "@/lib/prototype/bridgeCompletionPolicy";
import {
  buildInitialPlatformScmExecutionFromWip,
  extractCursorExternalScmFromBridgeResult,
} from "@/lib/prototype/platformScmExecution";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildPrototypeOrchestrationResult,
  type PrototypeOrchestrationResult,
} from "@/lib/prototype/prototypeOrchestrationResult";
import { CURSOR_API_UNSUPPORTED_MESSAGE } from "@/lib/prototype/cursorApiDirectClient";
import {
  BRIDGE_CALL_OK_SOURCE_REJECTED_HEADING,
  buildCursorApiDirectTimelineEntry,
  buildTargetRepoE2eTimelineEntry,
} from "@/lib/prototype/targetRepoE2eDiagnostics";

import type { CodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";

export type CursorBridgeOrchestrationResult = PrototypeOrchestrationResult;

export function patchWipForCursorBridgePhase(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly phase: "requested" | "running";
  readonly targetRepository?: string;
  readonly targetRepositorySnapshot?: CodeAgentTargetRepositorySnapshot;
  readonly workspacePath?: string;
  readonly baseBranch?: string;
  readonly allowedPathGlobs?: readonly string[];
}): CodeAgentWipExecutionV1 {
  const bridgeStatus = input.phase === "requested" ? "bridge_requested" : "bridge_running";
  return {
    ...input.wip,
    executionMode: "cursor_api",
    bridgeAdapter: "cursor_api",
    bridgeExecutionStatus: bridgeStatus,
    executionStatus: bridgeStatus,
    ...(input.targetRepository
      ? { targetRepository: input.targetRepository, targetRepoFullName: input.targetRepository }
      : {}),
    ...(input.targetRepositorySnapshot
      ? { targetRepositorySnapshot: input.targetRepositorySnapshot }
      : {}),
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
    ...(input.baseBranch ? { baseBranch: input.baseBranch } : {}),
    ...(input.allowedPathGlobs ? { bridgeAllowedPathGlobs: input.allowedPathGlobs } : {}),
    bridgeAutoPush: false,
    bridgeAutoPr: false,
    bridgeErrorMessage: undefined,
  };
}

export function buildCursorBridgeApiBlockedResult(input: {
  readonly selectedTaskId: string;
  readonly message: string;
}): CursorBridgeExecuteResult {
  return {
    ok: false,
    provider: "cursor",
    status: "blocked",
    selectedTaskId: input.selectedTaskId,
    errorMessage: input.message,
  };
}

function appendCursorBridgeGitTimelineEntries(input: {
  readonly timeline: readonly RequirementsPromptTimelineEntry[] | undefined;
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly repoFullName?: string;
  readonly workspacePath?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly changedFilesCount?: number;
  readonly runId?: string;
  readonly nowIso: string;
}): readonly RequirementsPromptTimelineEntry[] {
  let timeline = appendPromptTimeline(
    input.timeline,
    buildCursorApiDirectTimelineEntry({
      action: "cursor_api_direct_execution_completed",
      projectId: input.projectId,
      selectedTaskId: input.selectedTaskId,
      repoFullName: input.repoFullName,
      workspacePath: input.workspacePath,
      branchName: input.branchName,
      status: "completed",
      runId: input.runId,
      commitSha: input.commitSha,
      changedFilesCount: input.changedFilesCount,
      hasCommitSha: Boolean(input.commitSha),
      nowIso: input.nowIso,
    }),
  );
  if (input.commitSha) {
    timeline = appendPromptTimeline(
      timeline,
      buildCursorApiDirectTimelineEntry({
        action: "cursor_api_git_commit_created",
        projectId: input.projectId,
        selectedTaskId: input.selectedTaskId,
        repoFullName: input.repoFullName,
        workspacePath: input.workspacePath,
        branchName: input.branchName,
        status: "completed",
        runId: input.runId,
        commitSha: input.commitSha,
        changedFilesCount: input.changedFilesCount,
        nowIso: input.nowIso,
      }),
    );
  }
  return timeline;
}

function buildBridgeFailedMessage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly errorMessage: string;
  readonly nowIso: string;
  readonly unsupported?: boolean;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const heading = input.unsupported
    ? "Cursor API 직접 실행을 지원하지 않습니다."
    : input.errorMessage.includes("Cursor API")
      ? "Cursor API 호출에 실패했습니다."
      : "Cursor API 실행에 실패했습니다.";
  return newRequirementsMessage({
    id: `code-agent-bridge-failed-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      heading,
      "",
      "사유:",
      `- ${input.errorMessage}`,
      "",
      "다음 작업:",
      "- [Cursor 실행 요청]으로 다시 시도하거나",
      "- [추가 수정 요청] / [작업 폐기]를 선택해 주세요.",
    ].join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: "CODE_AGENT_WIP_BRIDGE_FAILED_V1",
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
    },
  });
}

export function applyCursorBridgeResultToWipExecution(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly bridgeResult: CursorBridgeExecuteResult;
  readonly commitTitle: string;
  readonly bridgeRequest?: CursorBridgeExecuteRequest;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();

  const validationContext =
    input.bridgeRequest != null
      ? bridgeResultValidationContextFromRequest(input.bridgeRequest)
      : bridgeValidationContextFromWip(input.wip, input.bridgeRequest);

  if (input.bridgeResult.ok && input.bridgeResult.status === "completed" && validationContext) {
    const eligible = evaluateBridgeResultEligibleForCompletion(input.bridgeResult, validationContext);
    if (!eligible.ok) {
      return {
        ...input.wip,
        bridgeExecutionStatus: "failed",
        executionStatus: "cursor_api_failed",
        bridgeErrorMessage: [
          BRIDGE_CALL_OK_SOURCE_REJECTED_HEADING,
          ...formatBridgeSourceGenerationRejectionMessage(eligible.reasons).split("\n").slice(1),
        ].join("\n"),
        bridgeCompletedAt: undefined,
      };
    }
  }

  if (!input.bridgeResult.ok || input.bridgeResult.status !== "completed") {
    return {
      ...input.wip,
      executionMode: "cursor_api",
      bridgeAdapter: "cursor_api",
      bridgeExecutionStatus: "failed",
      status: "failed",
      bridgeErrorMessage: input.bridgeResult.errorMessage,
      bridgeCompletedAt: undefined,
      executionStatus: "cursor_api_failed",
    };
  }

  const targetRepoFullName =
    input.bridgeResult.targetRepository?.trim() ||
    input.wip.targetRepoFullName ||
    input.wip.targetRepository ||
    input.wip.targetRepositorySnapshot?.repoFullName;

  const externalScm = extractCursorExternalScmFromBridgeResult(input.bridgeResult);

  const commit: CodeAgentWipCommit = {
    provider: input.wip.provider,
    sha: input.bridgeResult.commitSha!,
    branchName: input.bridgeResult.branchName ?? input.wip.branchName,
    commitMessage: input.commitTitle,
    taskId: input.bridgeResult.selectedTaskId,
    workItemId: input.wip.selectedWorkItemIds?.[0] ?? input.wip.workItems[0] ?? "unknown",
    changedFiles: [...(input.bridgeResult.changedFiles ?? [])],
    diffSummary: [...(input.bridgeResult.diffSummary ?? [])],
    testResults: [...(input.bridgeResult.testResults ?? [])],
    unresolvedIssues: ["SCM push/PR은 플랫폼 SCM 단계에서 수행합니다."],
    createdAt: now,
    ...(targetRepoFullName ? { targetRepository: targetRepoFullName } : {}),
  };

  const platformScmExecutionV1 = buildInitialPlatformScmExecutionFromWip({
    wip: input.wip,
    commitSha: commit.sha!,
    branchName: commit.branchName,
    nowIso: now,
  });

  return {
    ...input.wip,
    executionMode: "cursor_api",
    bridgeAdapter: "cursor_api",
    bridgeExecutionStatus: "bridge_completed",
    executionStatus: "bridge_completed",
    status: "developer_reviewing",
    branchName: commit.branchName,
    bridgeCompletedAt: now,
    commitSha: commit.sha,
    pushed: false,
    pushStatus: undefined,
    pushErrorMessage: undefined,
    prStatus: undefined,
    prNumber: undefined,
    ...externalScm,
    platformScmExecutionV1,
    ...(input.bridgeResult.workspacePath?.trim()
      ? { workspacePath: input.bridgeResult.workspacePath.trim() }
      : input.wip.workspacePath
        ? { workspacePath: input.wip.workspacePath }
        : {}),
    ...(input.wip.baseBranch || input.bridgeRequest?.baseBranch
      ? { baseBranch: input.wip.baseBranch ?? input.bridgeRequest?.baseBranch }
      : {}),
    ...(targetRepoFullName ? { targetRepository: targetRepoFullName, targetRepoFullName } : {}),
    ...(input.wip.targetRepositorySnapshot ? { targetRepositorySnapshot: input.wip.targetRepositorySnapshot } : {}),
    bridgeErrorMessage: undefined,
    commits: [...input.wip.commits.filter((c) => !c.sha?.startsWith("wip-stub")), commit],
    developerReview: {
      status: "pending",
      reviewedAt: now,
      reviewedBy: "ai_developer",
      summary: "Cursor API WIP commit 결과 검토 대기",
      findings: commit.unresolvedIssues,
      requestedActions: [],
    },
  };
}

export function buildCursorBridgeOrchestrationResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly bridgeResult: CursorBridgeExecuteResult;
  readonly bridgeRequest?: CursorBridgeExecuteRequest;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly runId?: string;
  readonly nowIso?: string;
}): CursorBridgeOrchestrationResult {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId = input.wip.selectedTaskId ?? input.bridgeResult.selectedTaskId;
  const commitTitle = buildProviderWipCommitMessage(
    input.wip.provider,
    `bridge result for ${taskId}`,
    false,
    taskId,
  );

  if (input.bridgeResult.status === "blocked") {
    const errorMessage = input.bridgeResult.errorMessage ?? "Cursor API 실행이 차단되었습니다.";
    const blockedWip: CodeAgentWipExecutionV1 = {
      ...input.wip,
      executionMode: "cursor_api",
      bridgeAdapter: "cursor_api",
      bridgeExecutionStatus: "failed",
      status: "failed",
      executionStatus: "cursor_api_failed",
      bridgeErrorMessage: errorMessage,
    };
    const timeline = appendPromptTimeline(
      input.promptTimeline,
      buildCursorApiDirectTimelineEntry({
        action: "cursor_api_direct_execution_failed",
        projectId: input.wip.projectId,
        selectedTaskId: taskId,
        repoFullName: blockedWip.targetRepoFullName ?? blockedWip.targetRepository,
        workspacePath: blockedWip.workspacePath,
        branchName: blockedWip.branchName,
        status: "blocked",
        reason: errorMessage,
        runId: input.runId,
        nowIso: now,
      }),
    );
    return buildPrototypeOrchestrationResult({
      kind: "blocked",
      message: errorMessage,
      requirementsStateJson: input.requirementsStateJson,
      newMessages: [
        buildBridgeFailedMessage({
          wip: blockedWip,
          errorMessage,
          nowIso: now,
        }),
      ],
      orchestrationPatch: {
        codeAgentWipExecutionV1: blockedWip,
        promptTimeline: timeline,
      },
    });
  }

  const runningWip: CodeAgentWipExecutionV1 = {
    ...input.wip,
    bridgeExecutionStatus: "bridge_running",
  };

  if (!input.bridgeResult.ok || input.bridgeResult.status === "failed") {
    const errorMessage = input.bridgeResult.errorMessage ?? "알 수 없는 오류";
    const unsupported =
      errorMessage.includes(CURSOR_API_UNSUPPORTED_MESSAGE.slice(0, 20)) ||
      errorMessage.includes("endpoint가 지원되지 않습니다");
    const failedWip: CodeAgentWipExecutionV1 = {
      ...runningWip,
      status: "failed",
      bridgeExecutionStatus: "failed",
      bridgeErrorMessage: errorMessage,
      executionStatus: unsupported ? "cursor_api_unsupported" : "cursor_api_failed",
      bridgeAdapter: "cursor_api",
    };
    const messages = [
      buildBridgeFailedMessage({
        wip: failedWip,
        errorMessage,
        nowIso: now,
        unsupported,
      }),
    ];
    const timeline = appendPromptTimeline(
      input.promptTimeline,
      buildCursorApiDirectTimelineEntry({
        action: unsupported
          ? "cursor_api_direct_execution_unsupported"
          : "cursor_api_direct_execution_failed",
        projectId: input.wip.projectId,
        selectedTaskId: taskId,
        repoFullName: failedWip.targetRepoFullName ?? failedWip.targetRepository,
        workspacePath: failedWip.workspacePath,
        branchName: failedWip.branchName,
        status: unsupported ? "unsupported" : "failed",
        reason: errorMessage,
        runId: input.runId,
        nowIso: now,
      }),
    );
    return buildPrototypeOrchestrationResult({
      kind: "failed",
      message: input.bridgeResult.errorMessage ?? "Cursor API 실행에 실패했습니다.",
      requirementsStateJson: input.requirementsStateJson,
      newMessages: messages,
      orchestrationPatch: {
        codeAgentWipExecutionV1: failedWip,
        promptTimeline: timeline,
      },
    });
  }

  const updatedWip = applyCursorBridgeResultToWipExecution({
    wip: runningWip,
    bridgeResult: input.bridgeResult,
    commitTitle,
    bridgeRequest: input.bridgeRequest,
    nowIso: now,
  });

  if (updatedWip.bridgeExecutionStatus === "failed") {
    const messages = [
      buildBridgeFailedMessage({
        wip: updatedWip,
        errorMessage: updatedWip.bridgeErrorMessage ?? "Bridge 결과 검증 실패",
        nowIso: now,
      }),
    ];
    const e2eRejected = buildTargetRepoE2eTimelineEntry({
      action: "cursor_bridge_source_generation_rejected",
      projectId: input.wip.projectId,
      selectedTaskId: taskId,
      repoFullName: updatedWip.targetRepoFullName ?? updatedWip.targetRepository,
      branchName: updatedWip.branchName,
      commitSha: input.bridgeResult.commitSha,
      changedFilesCount: input.bridgeResult.changedFiles?.length,
      pushStatus: updatedWip.pushStatus,
      prStatus: updatedWip.prStatus,
      status: "rejected",
      reason: updatedWip.bridgeErrorMessage,
      nowIso: now,
    });
    const timeline = appendPromptTimeline(
      appendPromptTimeline(
        input.promptTimeline,
        buildCodeAgentWipTimelineEntry({
          action: "cursor_bridge_failed",
          wip: updatedWip,
          taskIds: [taskId],
          actor: "code_agent",
          nowIso: now,
        }),
      ),
      e2eRejected,
    );
    return buildPrototypeOrchestrationResult({
      kind: "failed",
      message: updatedWip.bridgeErrorMessage ?? "Cursor API 실행 결과를 인정하지 않았습니다.",
      requirementsStateJson: input.requirementsStateJson,
      newMessages: messages,
      orchestrationPatch: {
        codeAgentWipExecutionV1: updatedWip,
        promptTimeline: timeline,
      },
    });
  }

  const lastCommit = updatedWip.commits[updatedWip.commits.length - 1]!;

  const messages = [
    buildCodeAgentWipBridgeCompletedMessage({
      wip: updatedWip,
      commit: lastCommit,
      nowIso: now,
    }),
  ];

  const timeline = appendCursorBridgeGitTimelineEntries({
    timeline: appendPromptTimeline(
      input.promptTimeline,
      buildCodeAgentWipTimelineEntry({
        action: "cursor_bridge_completed",
        wip: updatedWip,
        taskIds: [taskId],
        commitSha: lastCommit.sha,
        actor: "code_agent",
        nowIso: now,
      }),
    ),
    projectId: input.wip.projectId,
    selectedTaskId: taskId,
    repoFullName: updatedWip.targetRepoFullName ?? updatedWip.targetRepository,
    workspacePath: updatedWip.workspacePath,
    branchName: lastCommit.branchName,
    commitSha: lastCommit.sha,
    changedFilesCount: lastCommit.changedFiles.length,
    runId: input.runId,
    nowIso: now,
  });
  const timelineWithE2e = appendPromptTimeline(
    timeline,
    buildTargetRepoE2eTimelineEntry({
      action: "cursor_bridge_source_generation_completed",
      projectId: input.wip.projectId,
      selectedTaskId: taskId,
      repoFullName: updatedWip.targetRepoFullName ?? updatedWip.targetRepository,
      baseBranch: updatedWip.baseBranch,
      workspacePath: updatedWip.workspacePath,
      branchName: lastCommit.branchName,
      commitSha: lastCommit.sha,
      changedFilesCount: lastCommit.changedFiles.length,
      status: "completed",
      nowIso: now,
    }),
  );

  return buildPrototypeOrchestrationResult({
    kind: "completed",
    message: "Cursor API가 대상 프로젝트 저장소에 실제 소스를 생성했습니다.",
    requirementsStateJson: input.requirementsStateJson,
    newMessages: messages,
    orchestrationPatch: {
      codeAgentWipExecutionV1: updatedWip,
      promptTimeline: timelineWithE2e,
    },
  });
}
