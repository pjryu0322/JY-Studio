import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  applyStubWipCommitToExecution,
  buildCursorWipRequestedMessage,
  buildCursorWipReviewMessage,
  buildCursorWipTimelineEntry,
  buildDeveloperApprovedMessage,
  buildInitialCursorWipExecution,
  buildScmOfficialCommitPendingMessage,
  buildStubCursorWipCommit,
  buildWipCommitMessage,
  evaluateDeveloperApprovalGate,
  type CursorWipExecutionV1,
} from "@/lib/prototype/cursorWipExecution";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const ACTIVE_WIP_STATUSES = new Set<CursorWipExecutionV1["status"]>([
  "requested",
  "drafting",
  "wip_committed",
  "developer_reviewing",
  "refactor_requested",
  "refactoring",
  "wip_updated",
]);

export type CursorWipOrchestrationPatch = Readonly<{
  readonly cursorWipExecutionV1: CursorWipExecutionV1;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
}>;

export type CursorWipChatPatch = Readonly<{
  readonly messages: readonly RequirementsMessage[];
  readonly slots: readonly PrototypeExecutionInterviewSlot[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
}>;

export function buildRequestCursorWipWorkResult(input: {
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly existingWip: CursorWipExecutionV1 | null | undefined;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "already_active" }>
  | Readonly<{
      readonly kind: "created";
      readonly chatPatch: CursorWipChatPatch;
      readonly orchestrationPatch: CursorWipOrchestrationPatch;
    }> {
  if (input.existingWip && ACTIVE_WIP_STATUSES.has(input.existingWip.status)) {
    return { kind: "already_active" };
  }
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  const now = input.nowIso ?? new Date().toISOString();

  let wip = buildInitialCursorWipExecution({
    projectId: input.projectId,
    plan: input.plan,
    workItems: input.workItems,
    nowIso: now,
  });
  wip = { ...wip, status: "drafting" };

  const stubCommit = buildStubCursorWipCommit({ wip, plan: input.plan, workItems: input.workItems, nowIso: now });
  wip = applyStubWipCommitToExecution(wip, stubCommit);

  const taskIds = input.plan.items.map((t) => t.id);
  const messages = [
    ...prior,
    buildCursorWipRequestedMessage({ wip: { ...wip, status: "requested" }, plan: input.plan, nowIso: now }),
    buildCursorWipReviewMessage({ wip, commit: stubCommit, nowIso: now }),
  ];

  let timeline = appendPromptTimeline(input.promptTimeline, buildCursorWipTimelineEntry({
    action: "cursor_wip_requested",
    wip: { ...wip, status: "requested" },
    taskIds,
    workItemIds: input.workItems.map((w) => w.id),
    actor: "ai_developer",
    nowIso: now,
  }));
  timeline = appendPromptTimeline(timeline, buildCursorWipTimelineEntry({
    action: "cursor_wip_committed",
    wip,
    taskIds,
    commitSha: stubCommit.sha,
    actor: "cursor_tool",
    nowIso: now,
  }));
  timeline = appendPromptTimeline(timeline, buildCursorWipTimelineEntry({
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
      cursorWipExecutionV1: wip,
      promptTimeline: timeline,
    },
  };
}

export function buildDeveloperApproveWipResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CursorWipExecutionV1;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly missing: readonly string[] }>
  | Readonly<{
      readonly kind: "approved";
      readonly chatPatch: CursorWipChatPatch;
      readonly orchestrationPatch: CursorWipOrchestrationPatch;
    }> {
  const gate = evaluateDeveloperApprovalGate(input.wip);
  if (!gate.allowed) return { kind: "blocked", missing: gate.missing };

  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const now = input.nowIso ?? new Date().toISOString();
  const updated: CursorWipExecutionV1 = {
    ...input.wip,
    status: "developer_approved",
    developerReview: {
      status: "approved",
      reviewedAt: now,
      summary: "구현 결과 승인",
      findings: [],
      requestedActions: ["SCM에게 공식 반영 요청"],
    },
  };

  const messages = [...(resolved.messages ?? []), buildDeveloperApprovedMessage({ wip: updated, nowIso: now })];
  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildCursorWipTimelineEntry({
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
      cursorWipExecutionV1: updated,
      promptTimeline: timeline,
    },
  };
}

export function buildScmOfficialCommitRequestResult(input: {
  readonly requirementsStateJson: unknown;
  readonly wip: CursorWipExecutionV1;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly reason: string }>
  | Readonly<{
      readonly kind: "pending";
      readonly chatPatch: CursorWipChatPatch;
      readonly orchestrationPatch: CursorWipOrchestrationPatch;
    }> {
  if (input.wip.status !== "developer_approved") {
    return { kind: "blocked", reason: "AI개발자 승인 후 SCM 공식 반영을 요청할 수 있습니다." };
  }

  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const now = input.nowIso ?? new Date().toISOString();
  const updated: CursorWipExecutionV1 = { ...input.wip, status: "scm_commit_pending" };
  const messages = [...(resolved.messages ?? []), buildScmOfficialCommitPendingMessage({ wip: updated, nowIso: now })];
  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildCursorWipTimelineEntry({
      action: "scm_official_commit_pending",
      wip: updated,
      actor: "scm",
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
      cursorWipExecutionV1: updated,
      promptTimeline: timeline,
    },
  };
}

export function buildRefactorRequestWipState(input: {
  readonly wip: CursorWipExecutionV1;
  readonly instructions?: string;
  readonly nowIso?: string;
}): CursorWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const lastSha = input.wip.commits[input.wip.commits.length - 1]?.sha;
  const id = `refactor-${now}`;
  return {
    ...input.wip,
    status: "refactor_requested",
    developerReview: {
      status: "refactor_requested",
      reviewedAt: now,
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
        reason: "리팩토링 요청",
        instructions: input.instructions?.trim() || "",
        targetCommitSha: lastSha,
        status: "requested",
      },
    ],
  };
}

export function formatWipChangesView(wip: CursorWipExecutionV1): string {
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

export { buildWipCommitMessage };
