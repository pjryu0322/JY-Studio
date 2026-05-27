import {
  FAST_PLAN_ACTION_FEATURE_SCREEN_DETAIL,
  FAST_PLAN_ACTION_GENERATE_PLAN,
  FAST_PLAN_ACTION_GENERATION_PREP,
  FAST_PLAN_ACTION_REFINE_PLAN,
  FAST_PLAN_ACTION_SERVICE_FLOW_DETAIL,
  FAST_PLAN_ACTION_START_IMPLEMENTATION,
  FAST_PLAN_ACTION_VIEW_ARTIFACTS,
  FAST_PLAN_DRAFT_ACTION_CONFIRM,
  FAST_PLAN_DRAFT_ACTION_GENERATE_LEGACY,
  FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
  FAST_PLAN_DRAFT_ACTION_PRECISION,
  FAST_PLAN_DRAFT_ACTION_REGENERATE,
  isFastPlanDraftActionLabel,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import {
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  QUICK_DESIGN_CONFIRM_ACTION_LABEL,
} from "@/lib/requirements/implementationUxLabels";

export type FastPlanDraftSuggestionAction =
  | "confirm_draft_slots"
  | "request_draft"
  | "partial_edit"
  | "precision"
  | "service_flow_detail"
  | "feature_screen_detail"
  | "view_artifacts"
  | "start_implementation"
  | "refine";

export function normalizeFastPlanDraftChipLabel(label: string): string {
  return String(label ?? "").trim();
}

export function resolveFastPlanDraftSuggestionAction(label: string): FastPlanDraftSuggestionAction | null {
  const trimmed = normalizeFastPlanDraftChipLabel(label);
  if (
    trimmed === FAST_PLAN_DRAFT_ACTION_CONFIRM ||
    trimmed === QUICK_DESIGN_CONFIRM_ACTION_LABEL ||
    trimmed === FAST_PLAN_DRAFT_ACTION_GENERATE_LEGACY ||
    trimmed === "초안 확인/확정"
  ) {
    return "confirm_draft_slots";
  }
  if (trimmed === FAST_PLAN_ACTION_VIEW_ARTIFACTS || trimmed === "기획안 보기" || trimmed === "Artifact 보기") {
    return "view_artifacts";
  }
  if (
    trimmed === FAST_PLAN_ACTION_START_IMPLEMENTATION ||
    trimmed === IMPLEMENTATION_STAGE_NAVIGATE_LABEL
  ) {
    return "start_implementation";
  }
  if (trimmed === FAST_PLAN_ACTION_REFINE_PLAN || trimmed === "기획 보완 계속하기") return "refine";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_REGENERATE) return "request_draft";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT) return "partial_edit";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_PRECISION) return "precision";
  if (trimmed === FAST_PLAN_ACTION_SERVICE_FLOW_DETAIL) return "service_flow_detail";
  if (trimmed === FAST_PLAN_ACTION_FEATURE_SCREEN_DETAIL) return "feature_screen_detail";
  /** @deprecated legacy chips — no longer offered in UI */
  if (trimmed === FAST_PLAN_ACTION_GENERATE_PLAN) return "view_artifacts";
  if (trimmed === FAST_PLAN_ACTION_GENERATION_PREP || trimmed === "생성 단계로 이동") {
    return "start_implementation";
  }
  return null;
}

export function composerPromptForFastPlanDraftSuggestion(action: FastPlanDraftSuggestionAction): string | null {
  if (action === "partial_edit") return "수정할 항목을 알려 주세요: ";
  if (action === "precision") return "정밀 기획을 이어가겠습니다. 우선 확인할 슬롯을 알려 주세요.";
  if (action === "service_flow_detail") {
    return "서비스 흐름을 구체화하겠습니다. 액터와 단계를 중심으로 정리해 주세요.";
  }
  if (action === "feature_screen_detail") {
    return "기능과 화면 구성을 구체화하겠습니다. 우선 다룰 화면·기능을 알려 주세요.";
  }
  if (action === "refine") return "추가 보완을 이어가겠습니다. 우선 수정할 항목을 알려 주세요.";
  return null;
}

export function isKnownFastPlanDraftChipLabel(label: string): boolean {
  return isFastPlanDraftActionLabel(normalizeFastPlanDraftChipLabel(label));
}
