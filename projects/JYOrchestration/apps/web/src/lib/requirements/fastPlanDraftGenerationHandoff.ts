import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { FAST_PLAN_DRAFT_ACTION_GENERATE } from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";

export { FAST_PLAN_DRAFT_ACTION_GENERATE };

export const FAST_PLAN_ARTIFACT_CREATED_INTERNAL_TYPE = "fast_plan_artifact_created" as const;

export const FAST_PLAN_ARTIFACT_ACTION_VIEW = "기획안 보기" as const;
export const FAST_PLAN_ARTIFACT_ACTION_GO_GENERATION = "생성 단계로 이동" as const;
export const FAST_PLAN_ARTIFACT_ACTION_CONTINUE_PLANNING = "기획 보완 계속하기" as const;

export const FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS: readonly string[] = [
  FAST_PLAN_ARTIFACT_ACTION_VIEW,
  FAST_PLAN_ARTIFACT_ACTION_GO_GENERATION,
  FAST_PLAN_ARTIFACT_ACTION_CONTINUE_PLANNING,
] as const;

export type FastPlanArtifactFollowUpAction = "view_artifact" | "go_generation" | "continue_planning";

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
      reason: "현재 빠른 기획안을 생성할 수 없습니다. 프로젝트가 연결되지 않았습니다.",
      blockedBy: "missing_project_id",
    };
  }
  if (input.projectLoaded === false) {
    return {
      ready: false,
      reason: "현재 빠른 기획안을 생성할 수 없습니다. 프로젝트 상태를 다시 불러온 뒤 시도해 주세요.",
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
      reason: "원격 저장 중이라 빠른 기획안을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.",
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
      routingDecision: "generate_artifact",
      projectId: input.projectId,
      nowIso: input.nowIso,
    }),
    baseTimelineEntry({
      action: "fast_plan_generation_requested",
      routingDecision: "fast_plan_draft_to_generation",
      projectId: input.projectId,
      nowIso: input.nowIso,
      promptText: input.actionLabel,
      responseText: FAST_PLAN_DRAFT_ACTION_GENERATE,
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
    promptText: FAST_PLAN_DRAFT_ACTION_GENERATE,
    responseText: input.reason,
    error: input.reason,
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
    action: "fast_plan_artifact_created",
    routingDecision: "fast_plan_generation_completed",
    projectId: input.projectId,
    nowIso: input.nowIso,
    responseText: `artifactId=${input.artifactId}`,
  });
}

export function buildFastPlanArtifactCreatedChatMessage(input: {
  readonly artifactTitle: string;
  readonly artifactId: string;
  readonly nowIso?: string;
}): RequirementsMessage {
  const title = String(input.artifactTitle ?? "빠른 프로토타입 기획안").trim() || "빠른 프로토타입 기획안";
  const content = [
    "빠른 기획안 산출물을 생성했습니다.",
    "",
    `- 산출물: ${title}`,
    "- 상태: 후보/가정 포함",
    "- 다음 단계: 생성 단계에서 참조자료로 사용할 수 있습니다.",
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
      interviewSuggestions: [...FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS],
      interviewAllowCustomInput: true,
    },
  });
}

export function resolveFastPlanArtifactFollowUpAction(label: string): FastPlanArtifactFollowUpAction | null {
  const trimmed = String(label ?? "").trim();
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_VIEW) return "view_artifact";
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_GO_GENERATION) return "go_generation";
  if (trimmed === FAST_PLAN_ARTIFACT_ACTION_CONTINUE_PLANNING) return "continue_planning";
  return null;
}

export function isFastPlanArtifactFollowUpLabel(label: string): boolean {
  const trimmed = String(label ?? "").trim();
  return (FAST_PLAN_ARTIFACT_FOLLOW_UP_LABELS as readonly string[]).includes(trimmed);
}
