import type {
  RequirementsPromptTimelineEntry,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  FAST_PLAN_ACTION_GENERATE_PLAN,
  FAST_PLAN_ACTION_GENERATION_PREP,
  PLANNING_ARTIFACT_FOLLOW_UP_LABELS,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";

export { FAST_PLAN_ACTION_GENERATE_PLAN as FAST_PLAN_DRAFT_ACTION_GENERATE };

export const FAST_PLAN_ARTIFACT_CREATED_INTERNAL_TYPE = "fast_plan_artifact_created" as const;

export const FAST_PLAN_ARTIFACT_ACTION_VIEW = "기획안 보기" as const;
export const FAST_PLAN_ARTIFACT_ACTION_GO_GENERATION = FAST_PLAN_ACTION_GENERATION_PREP;
export const FAST_PLAN_ARTIFACT_ACTION_CONTINUE_PLANNING = "기획 보완 계속하기" as const;

export const FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS = PLANNING_ARTIFACT_FOLLOW_UP_LABELS;

export type FastPlanArtifactFollowUpAction =
  | "view_artifact"
  | "check_generation_readiness"
  | "continue_planning";

export type FastPlanGenerationHandoffReadiness = Readonly<{
  readonly ready: boolean;
  readonly reason: string | null;
  readonly blockedBy: string | null;
}>;

const PLATFORM_FAST_PLAN_TRACE_GROUP = "platform_fast_plan";

export function formatFastPlanPlatformTimelineResponse(input: {
  readonly routingDecision: string;
  readonly detail?: string;
}): string {
  const detail = String(input.detail ?? "ok").trim();
  return `[platform_fast_plan] routing=${input.routingDecision} ${detail}`;
}

export function evaluateFastPlanGenerationHandoffReadiness(input: {
  readonly projectId: string;
  readonly busy: boolean;
  readonly deliverableGenerateBusy: boolean;
  readonly remoteLocked: boolean;
  readonly conversationStatus?: string;
  readonly projectLoaded?: boolean;
}): FastPlanGenerationHandoffReadiness {
  const pid = String(input.projectId ?? "").trim();
  if (!pid) {
    return {
      ready: false,
      reason: "현재 기획안을 생성할 수 없습니다. 프로젝트가 연결되지 않았습니다.",
      blockedBy: "missing_project_id",
    };
  }
  if (input.projectLoaded === false) {
    return {
      ready: false,
      reason: "현재 기획안을 생성할 수 없습니다. 프로젝트 상태를 다시 불러온 뒤 시도해 주세요.",
      blockedBy: "project_not_loaded",
    };
  }
  if (input.conversationStatus && input.conversationStatus !== "loaded") {
    return {
      ready: false,
      reason: "대화를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
      blockedBy: "conversation_not_loaded",
    };
  }
  if (input.remoteLocked) {
    return {
      ready: false,
      reason: "원격 저장 중이라 기획안을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      blockedBy: "remote_locked",
    };
  }
  if (input.busy) {
    return {
      ready: false,
      reason: "다른 작업이 진행 중입니다. 완료 후 다시 시도해 주세요.",
      blockedBy: "workspace_busy",
    };
  }
  if (input.deliverableGenerateBusy) {
    return {
      ready: false,
      reason: "산출물 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
      blockedBy: "deliverable_generate_busy",
    };
  }
  return { ready: true, reason: null, blockedBy: null };
}

function baseTimelineEntry(input: {
  readonly action: string;
  readonly routingDecision: string;
  readonly projectId: string;
  readonly nowIso: string;
  readonly promptText?: string;
  readonly responseText?: string;
  readonly error?: string;
}): RequirementsPromptTimelineEntry {
  const responseText =
    String(input.responseText ?? "").trim() ||
    (input.error ? "" : formatFastPlanPlatformTimelineResponse({ routingDecision: input.routingDecision }));
  return {
    stage: "requirements",
    action: input.action,
    source: "platform",
    provider: "platform",
    model: "deterministic",
    routingDecision: input.routingDecision,
    orchestrationTraceGroup: PLATFORM_FAST_PLAN_TRACE_GROUP,
    promptText: input.promptText,
    responseText,
    error: input.error,
    createdAt: input.nowIso,
    aiMember: "AI 기획자",
  };
}

export function buildFastPlanDraftSuggestionPickedTimelineEntry(input: {
  readonly actionLabel: string;
  readonly routingDecision: string;
  readonly projectId: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "fast_plan_draft_suggestion_picked",
    routingDecision: input.routingDecision,
    projectId: input.projectId,
    nowIso: input.nowIso,
    promptText: input.actionLabel,
    responseText: formatFastPlanPlatformTimelineResponse({
      routingDecision: input.routingDecision,
      detail: `label=${input.actionLabel}`,
    }),
  });
}

export function buildFastPlanDraftGenerationHandoffTimeline(input: {
  readonly actionLabel: string;
  readonly projectId: string;
  readonly nowIso: string;
}): readonly RequirementsPromptTimelineEntry[] {
  return [
    buildFastPlanDraftSuggestionPickedTimelineEntry({
      actionLabel: input.actionLabel,
      routingDecision: "planning_artifact_generation_requested",
      projectId: input.projectId,
      nowIso: input.nowIso,
    }),
    baseTimelineEntry({
      action: "planning_artifact_generation_requested",
      routingDecision: "fast_plan_draft_to_generation",
      projectId: input.projectId,
      nowIso: input.nowIso,
      promptText: input.actionLabel,
      responseText: FAST_PLAN_ACTION_GENERATE_PLAN,
    }),
  ];
}

export function buildFastPlanGenerationBlockedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly reason: string;
  readonly blockedBy: string;
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "fast_plan_generation_blocked",
    routingDecision: input.blockedBy,
    projectId: input.projectId,
    nowIso: input.nowIso,
    promptText: FAST_PLAN_ACTION_GENERATE_PLAN,
    responseText: input.reason,
    error: input.reason,
  });
}

export function buildFastPlanDraftSlotsPatchedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly updatedSlotKeys: readonly string[];
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "fast_plan_draft_slots_patched",
    routingDecision: "fast_plan_draft_slots_patched",
    projectId: input.projectId,
    nowIso: input.nowIso,
    responseText: formatFastPlanPlatformTimelineResponse({
      routingDecision: "fast_plan_draft_slots_patched",
      detail: `slots=${input.updatedSlotKeys.join(",")}`,
    }),
  });
}

export function buildFastPlanGenerationFailedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly error: string;
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "fast_plan_generation_failed",
    routingDecision: "fast_plan_generation_error",
    projectId: input.projectId,
    nowIso: input.nowIso,
    error: input.error,
    responseText: input.error,
  });
}

export function buildFastPlanArtifactCreatedTimelineEntry(input: {
  readonly artifactId: string;
  readonly projectId: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "planning_artifact_created",
    routingDecision: "fast_plan_generation_completed",
    projectId: input.projectId,
    nowIso: input.nowIso,
    responseText: `artifactId=${input.artifactId}`,
  });
}

export function buildGenerationReadinessCheckedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly ready: boolean;
  readonly detail: string;
}): RequirementsPromptTimelineEntry {
  return baseTimelineEntry({
    action: "generation_readiness_checked",
    routingDecision: input.ready ? "generation_ready" : "generation_not_ready",
    projectId: input.projectId,
    nowIso: input.nowIso,
    promptText: FAST_PLAN_ACTION_GENERATION_PREP,
    responseText: input.detail,
    ...(input.ready ? {} : { error: input.detail }),
  });
}

export function buildFastPlanArtifactCreatedChatMessage(input: {
  readonly artifactTitle: string;
  readonly artifactId: string;
  readonly nowIso?: string;
}): RequirementsMessage {
  const title = String(input.artifactTitle ?? "기획안").trim() || "기획안";
  const content = [
    "기획안 산출물을 생성했습니다.",
    "",
    `- 산출물: ${title}`,
    "- 기준: 확정 슬롯 및 후보/가정 정보",
    "- 다음 단계: 생성 단계 준비에서 참조자료로 사용할 수 있습니다.",
    "",
    "아래 버튼에서 다음 동작을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content,
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: FAST_PLAN_ARTIFACT_CREATED_INTERNAL_TYPE,
      fastPlanArtifactId: input.artifactId,
      interviewSuggestions: [...FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS],
      interviewAllowCustomInput: true,
    },
  });
}

export function resolveFastPlanArtifactFollowUpAction(label: string): FastPlanArtifactFollowUpAction | null {
  const trimmed = String(label ?? "").trim();
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_VIEW) return "view_artifact";
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_GO_GENERATION || trimmed === "생성 단계로 이동") {
    return "check_generation_readiness";
  }
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_CONTINUE_PLANNING) return "continue_planning";
  return null;
}

export function resolvePlanningArtifactFollowUpAction(label: string): FastPlanArtifactFollowUpAction | null {
  return resolveFastPlanArtifactFollowUpAction(label);
}

export function isFastPlanArtifactFollowUpLabel(label: string): boolean {
  const trimmed = String(label ?? "").trim();
  return (FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS as readonly string[]).includes(trimmed);
}

export function fastPlanArtifactIdFromMessageMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const id = String((meta as { fastPlanArtifactId?: unknown }).fastPlanArtifactId ?? "").trim();
  return id || null;
}

export function findLatestFastPlanArtifactIdFromMessages(
  messages: readonly RequirementsMessage[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.meta?.internalType !== FAST_PLAN_ARTIFACT_CREATED_INTERNAL_TYPE) continue;
    const id = fastPlanArtifactIdFromMessageMeta(m.meta);
    if (id) return id;
  }
  return null;
}

/** 기획안 산출물 ID — 메시지 meta → deliverableAssets → generation state → projectArtifacts 순으로 조회 */
export function resolveFastPlanViewArtifactId(input: {
  readonly state: RequirementsStateJson;
  readonly messageArtifactId?: string | null;
}): string | null {
  const fromMessage = String(input.messageArtifactId ?? "").trim();
  if (fromMessage) return fromMessage;

  const deliverables = input.state.deliverableAssets ?? [];
  for (let i = deliverables.length - 1; i >= 0; i--) {
    const row = deliverables[i];
    const title = String(row?.title ?? "").trim();
    if (title === "기획안" || title.includes("기획안") || title.includes("빠른 프로토타입")) {
      const id = String(row.id ?? "").trim();
      if (id) return id;
    }
  }

  const fromGeneration = String(input.state.fastPlanGenerationV1?.artifactId ?? "").trim();
  if (fromGeneration) return fromGeneration;

  const artifacts = input.state.projectArtifacts ?? [];
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const row = artifacts[i];
    if (row?.type === "fast_prototype_plan") {
      const id = String(row.id ?? "").trim();
      if (id) return id;
    }
  }

  return null;
}

export const resolveLatestPlanningDeliverableAssetId = resolveFastPlanViewArtifactId;
export const resolvePlanningDeliverableAssetId = resolveFastPlanViewArtifactId;
