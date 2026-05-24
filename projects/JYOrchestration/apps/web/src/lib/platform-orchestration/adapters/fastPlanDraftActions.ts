import type { PlatformNextAction } from "@/lib/platform-orchestration/types";

export const FAST_PLAN_DRAFT_ACTION_GENERATE = "이 초안으로 빠른 기획안 생성" as const;
export const FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT = "일부 수정" as const;
export const FAST_PLAN_DRAFT_ACTION_REGENERATE = "다른 방향으로 다시 제안" as const;
export const FAST_PLAN_DRAFT_ACTION_PRECISION = "정밀 기획 계속하기" as const;

export const FAST_PLAN_DRAFT_NEXT_ACTION_LABELS: readonly string[] = [
  FAST_PLAN_DRAFT_ACTION_GENERATE,
  FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
  FAST_PLAN_DRAFT_ACTION_REGENERATE,
  FAST_PLAN_DRAFT_ACTION_PRECISION,
] as const;

export function isFastPlanDraftActionLabel(label: string): boolean {
  const t = String(label ?? "").trim();
  return (FAST_PLAN_DRAFT_NEXT_ACTION_LABELS as readonly string[]).includes(t);
}

export function buildFastPlanDraftNextActions(input: {
  readonly plannerReady: boolean;
}): readonly PlatformNextAction[] {
  return [
    {
      id: "fast_plan_draft_generate",
      label: FAST_PLAN_DRAFT_ACTION_GENERATE,
      kind: "artifact_generation",
      flowId: "fast_plan_generation",
      enabled: input.plannerReady,
      disabledReason: input.plannerReady ? null : "AI기획자(planner) 역할이 활성화되어 있지 않습니다.",
      payload: { action: "generate_fast_prototype_plan" },
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
