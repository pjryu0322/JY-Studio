import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  applyStubWipCommitToExecution,
  buildCodeAgentWipExecutionMessage,
  buildCodeAgentWipRequestedMessage,
  buildCodeAgentWipTimelineEntry,
  buildDeveloperApprovedMessage,
  buildInitialCodeAgentWipExecution,
  buildScmOfficialCommitPendingMessage,
  buildStubCodeAgentWipCommit,
  evaluateDeveloperApprovalGate,
  isStubCodeAgentWipExecution,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import { validateTaskScopedWorkItems } from "@/lib/prototype/implementationCursorWorkItems";
import { buildWipPlatformScmPushRequestPatch } from "@/lib/prototype/platformScmExecution";
import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { buildPlatformScmTimelineEntry } from "@/lib/prototype/targetRepoE2eDiagnostics";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const ACTIVE_WIP_STATUSES = new Set<CodeAgentWipExecutionV1["status"]>([
  "requested",
  "drafting",
  "wip_committed",
  "developer_reviewing",
  "refactor_requested",
  "refactoring",
  "wip_updated",
]);

export type CodeAgentWipOrchestrationPatch = Readonly<{
  readonly codeAgentWipExecutionV1: CodeAgentWipExecutionV1;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
}>;

export type CodeAgentWipChatPatch = Readonly<{
  readonly messages: readonly RequirementsMessage[];
  readonly slots: readonly PrototypeExecutionInterviewSlot[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
}>;

export function buildRequestCodeAgentWipWorkResult(input: {
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly existingWip: CodeAgentWipExecutionV1 | null | undefined;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly selectedTaskId?: string | null;
  readonly selectedWorkItemIds?: readonly string[];
  readonly totalCandidateCount?: number;
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "already_active" }>
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "created";
      readonly chatPatch: CodeAgentWipChatPatch;
      readonly orchestrationPatch: CodeAgentWipOrchestrationPatch;
    }> {
  if (input.existingWip) {
    const bridge = input.existingWip.bridgeExecutionStatus;
    if (
      ACTIVE_WIP_STATUSES.has(input.existingWip.status) ||
      bridge === "draft_created" ||
      bridge === "draft_approved" ||
      bridge === "bridge_requested" ||
      bridge === "bridge_running"
    ) {
      return { kind: "already_active" };
    }
  }
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  const now = input.nowIso ?? new Date().toISOString();

  const selectedTaskId = input.selectedTaskId?.trim() || input.workItems[0]?.taskId?.trim() || "";
  if (!selectedTaskId) {
    return { kind: "blocked", message: "WIP 실행 대상 taskId를 결정하지 못했습니다." };
  }
  const scopedValidation = validateTaskScopedWorkItems({
    selectedTaskId,
    selectedWorkItems: input.workItems,
  });
  if (!scopedValidation.ok) {
    return { kind: "blocked", message: scopedValidation.message };
  }
  const selectedWorkItemIds =
    input.selectedWorkItemIds?.length
      ? input.selectedWorkItemIds
      : input.workItems.map((w) => w.id);

  let wip = buildInitialCodeAgentWipExecution({
    projectId: input.projectId,
    plan: input.plan,
    workItems: input.workItems,
    selectedTaskId,
    executionMode: "stub",
    bridgeExecutionStatus: "draft_created",
    nowIso: now,
  });
  wip = {
    ...wip,
    status: "drafting",
    selectedTaskId,
    selectedWorkItemIds,
    executionMode: "stub",
    bridgeExecutionStatus: "draft_created",
    executionStatus: "draft_created",
    bridgeAdapter: "cursor_api",
  };

  const stubCommit = buildStubCodeAgentWipCommit({ wip, plan: input.plan, workItems: input.workItems, nowIso: now });
  wip = applyStubWipCommitToExecution(wip, stubCommit);
  wip = {
    ...wip,
    executionMode: "stub",
    bridgeExecutionStatus: "draft_created",
    executionStatus: "draft_created",
    bridgeAdapter: "cursor_api",
  };

  const taskIds = [selectedTaskId];
  const messages = [
    ...prior,
    buildCodeAgentWipRequestedMessage({ wip: { ...wip, status: "requested" }, plan: input.plan, nowIso: now }),
    buildCodeAgentWipExecutionMessage({
      wip,
      commit: stubCommit,
      selectedTaskId,
      selectedWorkItems: input.workItems,
      totalCandidateCount: input.totalCandidateCount,
      nowIso: now,
    }),
  ];

  let timeline = appendPromptTimeline(input.promptTimeline, buildCodeAgentWipTimelineEntry({
    action: "code_agent_wip_requested",
    wip: { ...wip, status: "requested" },
    taskIds,
    workItemIds: selectedWorkItemIds,
    actor: "ai_developer",
    nowIso: now,
  }));
  timeline = appendPromptTimeline(timeline, buildCodeAgentWipTimelineEntry({
    action: "code_agent_wip_committed",
    wip,
    taskIds,
    commitSha: stubCommit.sha,
    actor: "code_agent",
    nowIso: now,
  }));
  timeline = appendPromptTimeline(timeline, buildCodeAgentWipTimelineEntry({
    action: "developer_review_started",
    wip,
    taskIds,
    actor: "ai_developer",
    nowIso: now,
  }));

  return {
    kind: "created",
    chatPatch: {
      messages,
      slots: resolved.slots ?? [],
      answers: resolved.answers ?? {},
      currentSlotKey: resolved.currentSlotKey ?? null,
    },
    orchestrationPatch: {
      codeAgentWipExecutionV1: wip,
      promptTimeline: timeline,
    },
  };
}

export function buildDeveloperApproveWipResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly missing: readonly string[] }>
  | Readonly<{
      readonly kind: "approved";
      readonly chatPatch: CodeAgentWipChatPatch;
      readonly orchestrationPatch: CodeAgentWipOrchestrationPatch;
    }> {
  const gate = evaluateDeveloperApprovalGate(input.wip);
  if (!gate.allowed) return { kind: "blocked", missing: gate.missing };

  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const now = input.nowIso ?? new Date().toISOString();
  const stubApproved = isStubCodeAgentWipExecution(input.wip);
  const updated: CodeAgentWipExecutionV1 = {
    ...input.wip,
    status: "developer_approved",
    ...(stubApproved ? { bridgeExecutionStatus: "draft_approved" as const } : {}),
    developerReview: {
      status: "approved",
      reviewedAt: now,
      reviewedBy: "ai_developer",
      summary: stubApproved ? "WIP 초안 승인" : "구현 결과 승인",
      findings: [],
      requestedActions: stubApproved
        ? ["실제 Cursor API 실행 또는 다음 생성요청"]
        : ["SCM에게 공식 반영 요청"],
    },
  };

  const messages = [...(resolved.messages ?? []), buildDeveloperApprovedMessage({ wip: updated, nowIso: now })];
  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildCodeAgentWipTimelineEntry({
      action: "developer_approved",
      wip: updated,
      actor: "ai_developer",
      nowIso: now,
    }),
  );

  return {
    kind: "approved",
    chatPatch: {
      messages,
      slots: resolved.slots ?? [],
      answers: resolved.answers ?? {},
      currentSlotKey: resolved.currentSlotKey ?? null,
    },
    orchestrationPatch: {
      codeAgentWipExecutionV1: updated,
      promptTimeline: timeline,
    },
  };
}

export function buildScmOfficialCommitRequestResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CodeAgentWipExecutionV1;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly reason: string }>
  | Readonly<{
      readonly kind: "pending";
      readonly chatPatch: CodeAgentWipChatPatch;
      readonly orchestrationPatch: CodeAgentWipOrchestrationPatch;
    }> {
  if (input.wip.status !== "developer_approved" && input.wip.status !== "scm_commit_pending") {
    return { kind: "blocked", reason: "AI개발자 승인 후 SCM 공식 반영을 요청할 수 있습니다." };
  }
  const scmPushStatus = input.wip.platformScmExecutionV1?.pushStatus;
  if (
    input.wip.status === "scm_commit_pending" &&
    scmPushStatus !== "push_failed" &&
    scmPushStatus !== "pr_failed" &&
    scmPushStatus !== "pending" &&
    scmPushStatus !== "push_requested"
  ) {
    return { kind: "blocked", reason: "플랫폼 SCM push/PR이 이미 진행 중이거나 완료되었습니다." };
  }

  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const now = input.nowIso ?? new Date().toISOString();
  const updated: CodeAgentWipExecutionV1 = buildWipPlatformScmPushRequestPatch({
    wip: { ...input.wip, status: "scm_commit_pending" },
    nowIso: now,
  });
  const messages = [...(resolved.messages ?? []), buildScmOfficialCommitPendingMessage({ wip: updated, nowIso: now })];
  const timeline = appendPromptTimeline(
    appendPromptTimeline(
      input.promptTimeline,
      buildCodeAgentWipTimelineEntry({
        action: "scm_official_commit_pending",
        wip: updated,
        actor: "scm",
        nowIso: now,
      }),
    ),
    buildPlatformScmTimelineEntry({
      action: "platform_scm_push_requested",
      projectId: updated.projectId,
      selectedTaskId: updated.selectedTaskId ?? updated.workItems[0] ?? "unknown",
      repoFullName: updated.targetRepoFullName ?? updated.targetRepository,
      branchName: updated.branchName,
      commitSha: updated.commitSha ?? updated.commits[updated.commits.length - 1]?.sha,
      status: "requested",
      nowIso: now,
    }),
  );

  return {
    kind: "pending",
    chatPatch: {
      messages,
      slots: resolved.slots ?? [],
      answers: resolved.answers ?? {},
      currentSlotKey: resolved.currentSlotKey ?? null,
    },
    orchestrationPatch: {
      codeAgentWipExecutionV1: updated,
      promptTimeline: timeline,
    },
  };
}

export function buildRefactorRequestWipState(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly instructions?: string;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const lastSha = input.wip.commits[input.wip.commits.length - 1]?.sha;
  const id = `refactor-${now}`;
  return {
    ...input.wip,
    status: "refactor_requested",
    developerReview: {
      status: "refactor_requested",
      reviewedAt: now,
      reviewedBy: "ai_developer",
      summary: "리팩토링 요청",
      findings: [],
      requestedActions: [input.instructions?.trim() || "리팩토링 지시 입력 대기"],
    },
    refactorRequests: [
      ...input.wip.refactorRequests,
      {
        id,
        requestedAt: now,
        requestedBy: "ai_developer",
        provider: input.wip.provider,
        reason: "리팩토링 요청",
        instructions: input.instructions?.trim() || "",
        targetCommitSha: lastSha,
        status: "requested",
      },
    ],
  };
}

export function formatWipChangesView(wip: CodeAgentWipExecutionV1): string {
  const last = wip.commits[wip.commits.length - 1];
  if (!last) return "표시할 WIP commit이 없습니다.";
  return [
    `브랜치: ${last.branchName}`,
    `commit: ${last.commitMessage}`,
    "",
    "변경 파일:",
    ...last.changedFiles.map((f) => `- ${f}`),
    "",
    "diff 요약:",
    ...last.diffSummary.map((d) => `- ${d}`),
  ].join("\n");
}

export const REFACTOR_REQUEST_PROMPT =
  "리팩토링 요청 내용을 입력해 주세요.\n예: 업로드 검증 로직을 별도 함수로 분리하고, 에러 메시지를 한국어로 정리해 주세요.";

export { buildProviderWipCommitMessage as buildWipCommitMessage };
