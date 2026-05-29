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
  resolveBridgePushAndPrStatus,
} from "@/lib/prototype/bridgeCompletionPolicy";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { CodeAgentWipOrchestrationPatch } from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";
import { CURSOR_API_UNSUPPORTED_MESSAGE } from "@/lib/prototype/cursorApiDirectClient";
import {
  BRIDGE_CALL_OK_SOURCE_REJECTED_HEADING,
  buildCursorApiDirectTimelineEntry,
  buildTargetRepoE2eTimelineEntry,
} from "@/lib/prototype/targetRepoE2eDiagnostics";

export type CursorBridgeOrchestrationResult = Readonly<{
  readonly kind: "blocked" | "failed" | "completed";
  readonly message: string;
  readonly chatPatch?: {
    readonly messages: readonly RequirementsMessage[];
    readonly slots: readonly PrototypeExecutionInterviewSlot[];
    readonly answers: Readonly<Record<string, string>>;
    readonly currentSlotKey: string | null;
  };
  readonly orchestrationPatch?: CodeAgentWipOrchestrationPatch;
}>;

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
      : "Cursor Bridge 실행에 실패했습니다.";
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
      bridgeExecutionStatus: "failed",
      bridgeErrorMessage: input.bridgeResult.errorMessage,
      bridgeCompletedAt: undefined,
    };
  }

  const targetRepoFullName =
    input.bridgeResult.targetRepository?.trim() ||
    input.wip.targetRepoFullName ||
    input.wip.targetRepository ||
    input.wip.targetRepositorySnapshot?.repoFullName;

  const autoPush = input.bridgeRequest?.autoPush ?? input.wip.bridgeAutoPush ?? input.wip.pushed === true;
  const autoPr = input.bridgeRequest?.autoPr ?? input.wip.bridgeAutoPr ?? false;
  const pushPr =
    input.bridgeResult.pushStatus && input.bridgeResult.prStatus
      ? {
          pushStatus: input.bridgeResult.pushStatus,
          pushStatusLine:
            input.bridgeResult.pushStatus === "success"
              ? "Push: 성공"
              : input.bridgeResult.pushStatus === "failed"
                ? `Push: 실패 — ${input.bridgeResult.pushErrorMessage ?? "unknown"}`
                : autoPush
                  ? "Push: 미수행"
                  : "Push: 미수행 — 환경설정 autoPush=false",
          prStatusLine: input.bridgeResult.prStatus,
          pushErrorMessage: input.bridgeResult.pushErrorMessage,
        }
      : resolveBridgePushAndPrStatus({
          autoPush,
          autoPr,
          pushed: input.bridgeResult.pushed,
          pushErrorMessage: input.bridgeResult.pushErrorMessage,
          prNumber: input.bridgeResult.prNumber,
        });

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
    unresolvedIssues:
      pushPr.pushStatus === "success"
        ? ["공식 PR/merge는 AI개발자 승인 후 SCM 단계에서 수행합니다."]
        : pushPr.pushStatus === "failed"
          ? [
              pushPr.pushStatusLine,
              "Commit은 생성되었습니다. push 실패 후 수동 push 또는 재시도가 필요할 수 있습니다.",
              "공식 PR/merge는 AI개발자 승인 후 SCM 단계에서 수행합니다.",
            ]
          : [
              pushPr.pushStatusLine,
              "공식 PR/merge는 AI개발자 승인 후 SCM 단계에서 수행합니다.",
            ],
    createdAt: now,
    ...(targetRepoFullName ? { targetRepository: targetRepoFullName } : {}),
  };

  return {
    ...input.wip,
    executionMode: "cursor_api",
    bridgeAdapter: "cursor_api",
    bridgeExecutionStatus: "bridge_completed",
    status: "developer_reviewing",
    branchName: commit.branchName,
    bridgeCompletedAt: now,
    commitSha: commit.sha,
    pushed: input.bridgeResult.pushed === true,
    pushStatus: pushPr.pushStatus,
    ...(pushPr.pushErrorMessage ? { pushErrorMessage: pushPr.pushErrorMessage } : {}),
    prStatus: pushPr.prStatusLine,
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
    ...(input.bridgeResult.prNumber !== undefined ? { prNumber: input.bridgeResult.prNumber } : {}),
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
  readonly nowIso?: string;
}): CursorBridgeOrchestrationResult {
  const now = input.nowIso ?? new Date().toISOString();
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];

  const taskId = input.wip.selectedTaskId ?? input.bridgeResult.selectedTaskId;
  const commitTitle = buildProviderWipCommitMessage(
    input.wip.provider,
    `bridge result for ${taskId}`,
    false,
    taskId,
  );

  if (input.bridgeResult.status === "blocked") {
    return {
      kind: "blocked",
      message: input.bridgeResult.errorMessage ?? "Cursor Bridge 실행이 차단되었습니다.",
    };
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
      bridgeExecutionStatus: "failed",
      bridgeErrorMessage: errorMessage,
      ...(input.bridgeRequest?.bridgeAdapter ? { bridgeAdapter: input.bridgeRequest.bridgeAdapter } : {}),
    };
    const messages = [
      ...prior,
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
        nowIso: now,
      }),
    );
    return {
      kind: "failed",
      message: input.bridgeResult.errorMessage ?? "Cursor Bridge 실행에 실패했습니다.",
      chatPatch: {
        messages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      },
      orchestrationPatch: {
        codeAgentWipExecutionV1: failedWip,
        promptTimeline: timeline,
      },
    };
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
      ...prior,
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
    return {
      kind: "failed",
      message: updatedWip.bridgeErrorMessage ?? "Cursor Bridge 실행 결과를 인정하지 않았습니다.",
      chatPatch: {
        messages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      },
      orchestrationPatch: {
        codeAgentWipExecutionV1: updatedWip,
        promptTimeline: timeline,
      },
    };
  }

  const lastCommit = updatedWip.commits[updatedWip.commits.length - 1]!;

  const messages = [
    ...prior,
    buildCodeAgentWipBridgeCompletedMessage({
      wip: updatedWip,
      commit: lastCommit,
      nowIso: now,
    }),
  ];

  const e2eCompleted = buildTargetRepoE2eTimelineEntry({
    action: "cursor_bridge_source_generation_completed",
    projectId: input.wip.projectId,
    selectedTaskId: taskId,
    repoFullName: updatedWip.targetRepoFullName ?? updatedWip.targetRepository,
    baseBranch: updatedWip.baseBranch,
    workspacePath: updatedWip.workspacePath,
    branchName: lastCommit.branchName,
    commitSha: lastCommit.sha,
    changedFilesCount: lastCommit.changedFiles.length,
    pushStatus: updatedWip.pushStatus,
    prStatus: updatedWip.prStatus,
    status: "completed",
    nowIso: now,
  });
  const timeline = appendPromptTimeline(
    appendPromptTimeline(
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
    e2eCompleted,
  );

  return {
    kind: "completed",
    message: "Cursor API가 대상 프로젝트 저장소에 실제 소스를 생성했습니다.",
    chatPatch: {
      messages,
      slots: resolved.slots ?? [],
      answers: resolved.answers ?? {},
      currentSlotKey: resolved.currentSlotKey ?? null,
    },
    orchestrationPatch: {
      codeAgentWipExecutionV1: updatedWip,
      promptTimeline: timeline,
    },
  };
}
