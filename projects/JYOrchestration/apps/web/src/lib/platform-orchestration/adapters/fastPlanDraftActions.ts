import type { PlatformNextAction } from "@/lib/platform-orchestration/types";

export const FAST_PLAN_DRAFT_ACTION_CONFIRM = "초안 확인/확정" as const;
export const FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT = "일부 수정" as const;
export const FAST_PLAN_DRAFT_ACTION_REGENERATE = "다른 방향으로 다시 제안" as const;
export const FAST_PLAN_DRAFT_ACTION_PRECISION = "정밀 기획 계속하기" as const;

/** @deprecated 초안 단계 칩 — 확인/확정으로 대체됨 */
export const FAST_PLAN_DRAFT_ACTION_GENERATE_LEGACY = "이 초안으로 빠른 기획안 생성" as const;

export const FAST_PLAN_ACTION_GENERATE_PLAN = "기획안 생성" as const;
/** @deprecated use FAST_PLAN_ACTION_GENERATE_PLAN */
export const FAST_PLAN_DRAFT_ACTION_GENERATE = FAST_PLAN_ACTION_GENERATE_PLAN;
export const FAST_PLAN_ACTION_SERVICE_FLOW_DETAIL = "서비스 흐름 구체화" as const;
export const FAST_PLAN_ACTION_FEATURE_SCREEN_DETAIL = "기능/화면 구체화" as const;
export const FAST_PLAN_ACTION_GENERATION_PREP = "생성 단계 준비" as const;

export const FAST_PLAN_DRAFT_NEXT_ACTION_LABELS: readonly string[] = [
  FAST_PLAN_DRAFT_ACTION_CONFIRM,
  FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
  FAST_PLAN_DRAFT_ACTION_REGENERATE,
  FAST_PLAN_DRAFT_ACTION_PRECISION,
] as const;

export const FAST_PLAN_DRAFT_CONFIRMED_NEXT_LABELS: readonly string[] = [
  FAST_PLAN_ACTION_GENERATE_PLAN,
  FAST_PLAN_ACTION_SERVICE_FLOW_DETAIL,
  FAST_PLAN_ACTION_FEATURE_SCREEN_DETAIL,
  FAST_PLAN_ACTION_GENERATION_PREP,
] as const;

export const PLANNING_ARTIFACT_FOLLOW_UP_LABELS: readonly string[] = [
  "기획안 보기",
  FAST_PLAN_ACTION_GENERATION_PREP,
  "기획 보완 계속하기",
] as const;

export function isFastPlanDraftActionLabel(label: string): boolean {
  const t = String(label ?? "").trim();
  return (
    (FAST_PLAN_DRAFT_NEXT_ACTION_LABELS as readonly string[]).includes(t) ||
    (FAST_PLAN_DRAFT_CONFIRMED_NEXT_LABELS as readonly string[]).includes(t) ||
    (PLANNING_ARTIFACT_FOLLOW_UP_LABELS as readonly string[]).includes(t) ||
    t === FAST_PLAN_DRAFT_ACTION_GENERATE_LEGACY
  );
}

export function buildFastPlanDraftNextActions(input: {
  readonly plannerReady: boolean;
}): readonly PlatformNextAction[] {
  return [
    {
      id: "fast_plan_draft_confirm",
      label: FAST_PLAN_DRAFT_ACTION_CONFIRM,
      kind: "slot_action",
      flowId: "fast_plan_draft",
      enabled: input.plannerReady,
      disabledReason: input.plannerReady ? null : "AI기획자(planner) 역할이 활성화되어 있지 않습니다.",
      payload: { action: "confirm_draft_slots" },
    },
    {
      id: "fast_plan_draft_partial_edit",
      label: FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
      kind: "chat_reply",
      flowId: "single_chat_turn",
      enabled: true,
      disabledReason: null,
      payload: { action: "partial_edit" },
    },
    {
      id: "fast_plan_draft_regenerate",
      label: FAST_PLAN_DRAFT_ACTION_REGENERATE,
      kind: "flow_transition",
      flowId: "fast_plan_draft",
      enabled: input.plannerReady,
      disabledReason: input.plannerReady ? null : "AI기획자(planner) 역할이 활성화되어 있지 않습니다.",
      payload: { action: "regenerate_draft" },
    },
    {
      id: "fast_plan_draft_precision",
      label: FAST_PLAN_DRAFT_ACTION_PRECISION,
      kind: "flow_transition",
      flowId: "planning_slots",
      enabled: true,
      disabledReason: null,
      payload: { action: "continue_precision_planning" },
    },
  ];
}

export function buildFastPlanDraftConfirmedNextActions(input: {
  readonly generationPrepReady: boolean;
  readonly generationPrepReason?: string | null;
}): readonly string[] {
  return FAST_PLAN_DRAFT_CONFIRMED_NEXT_LABELS.map((label) => {
    if (label === FAST_PLAN_ACTION_GENERATION_PREP && !input.generationPrepReady) {
      return label;
    }
    return label;
  });
}
