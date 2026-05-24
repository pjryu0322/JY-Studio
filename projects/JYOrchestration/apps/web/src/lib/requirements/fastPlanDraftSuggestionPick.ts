import {
  FAST_PLAN_DRAFT_ACTION_GENERATE,
  FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT,
  FAST_PLAN_DRAFT_ACTION_PRECISION,
  FAST_PLAN_DRAFT_ACTION_REGENERATE,
  isFastPlanDraftActionLabel,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";

export type FastPlanDraftSuggestionAction =
  | "generate_artifact"
  | "request_draft"
  | "partial_edit"
  | "precision";

export function normalizeFastPlanDraftChipLabel(label: string): string {
  return String(label ?? "").trim();
}

export function resolveFastPlanDraftSuggestionAction(label: string): FastPlanDraftSuggestionAction | null {
  const trimmed = normalizeFastPlanDraftChipLabel(label);
  if (trimmed === FAST_PLAN_DRAFT_ACTION_GENERATE) return "generate_artifact";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_REGENERATE) return "request_draft";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_PARTIAL_EDIT) return "partial_edit";
  if (trimmed === FAST_PLAN_DRAFT_ACTION_PRECISION) return "precision";
  return null;
}

export function composerPromptForFastPlanDraftSuggestion(action: FastPlanDraftSuggestionAction): string | null {
  if (action === "partial_edit") return "다음 항목을 수정하고 싶습니다: ";
  if (action === "precision") return "정밀 기획을 이어가겠습니다. 우선 확인할 슬롯을 알려 주세요.";
  return null;
}

export function isKnownFastPlanDraftChipLabel(label: string): boolean {
  return isFastPlanDraftActionLabel(normalizeFastPlanDraftChipLabel(label));
}
