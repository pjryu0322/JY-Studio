import {
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  PLANNING_DATABASE_SETUP_LABEL,
} from "@/lib/requirements/implementationUxLabels";

export const IMPLEMENTATION_SEED_CONFIRM_CTA_LABEL = "Implementation Seed 확정" as const;

export const IMPLEMENTATION_CANDIDATE_APPLY_ALL_LABEL = "전체 보완안 적용" as const;
export const IMPLEMENTATION_CANDIDATE_APPLY_SELECTED_LABEL = "선택 보완안 적용" as const;
export const IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL = "항목별 수정" as const;
export const IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL =
  "추가 확인 필요 항목만 보기" as const;
export const IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL = "다시 검토" as const;
export const IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL = "나중에 검토" as const;

export const ALL_IMPLEMENTATION_CANDIDATE_REFINE_CTA_LABELS: readonly string[] = [
  IMPLEMENTATION_CANDIDATE_APPLY_ALL_LABEL,
  IMPLEMENTATION_CANDIDATE_APPLY_SELECTED_LABEL,
  IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL,
  IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL,
  IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL,
  IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL,
  IMPLEMENTATION_SEED_CONFIRM_CTA_LABEL,
] as const;

export type ImplementationCandidateRefineCtaAction =
  | "apply_all"
  | "apply_selected"
  | "edit_by_item"
  | "view_needs_confirmation"
  | "review_again"
  | "review_later"
  | "confirm_seed";

export function resolveImplementationCandidateRefineCtaAction(
  label: string,
): ImplementationCandidateRefineCtaAction | null {
  const t = String(label ?? "").trim();
  if (t === IMPLEMENTATION_SEED_CONFIRM_CTA_LABEL) return "confirm_seed";
  if (t === IMPLEMENTATION_CANDIDATE_APPLY_ALL_LABEL) return "apply_all";
  if (t === IMPLEMENTATION_CANDIDATE_APPLY_SELECTED_LABEL) return "apply_selected";
  if (t === IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL) return "edit_by_item";
  if (t === IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL) return "view_needs_confirmation";
  if (t === IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL) return "review_again";
  if (t === IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL) return "review_later";
  return null;
}

export function isImplementationCandidateRefineCtaLabel(label: string): boolean {
  return resolveImplementationCandidateRefineCtaAction(label) !== null;
}

export function buildApplyImplementationCandidateRefineComposerPrompt(input: {
  readonly mode: "all" | "selected";
  readonly labels: readonly string[];
}): string {
  const list = input.labels.map((l) => String(l ?? "").trim()).filter(Boolean).join(", ");
  if (input.mode === "all") {
    return "기획정보 후보 항목 전체 보완안을 적용해 주세요. 적용된 항목과 남은 확인 항목을 정리해 주세요.";
  }
  return `다음 기획정보 후보 항목 보완안을 적용해 주세요: ${list}`;
}

export function implementationCandidateRefineApplyResultChips(input?: {
  readonly seedReady?: boolean;
  readonly showSeedConfirm?: boolean;
}): readonly string[] {
  const chips: string[] = [];
  if (input?.showSeedConfirm !== false) {
    chips.push(IMPLEMENTATION_SEED_CONFIRM_CTA_LABEL);
  }
  chips.push(
    IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL,
    IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL,
    IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL,
  );
  if (input?.seedReady) {
    chips.push(IMPLEMENTATION_STAGE_NAVIGATE_LABEL);
  }
  chips.push(IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL);
  return chips;
}

export function implementationSeedConfirmResultChips(input: {
  readonly seedReady: boolean;
  readonly dbReady?: boolean | null;
}): readonly string[] {
  if (!input.seedReady) {
    return [
      IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL,
      IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL,
      IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL,
      IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL,
    ];
  }
  const chips: string[] = [IMPLEMENTATION_STAGE_NAVIGATE_LABEL];
  if (input.dbReady === false) {
    chips.unshift(PLANNING_DATABASE_SETUP_LABEL);
  }
  chips.push(IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL);
  return chips;
}

export function isImplementationCandidateRefineApplyResultCtaLabel(label: string): boolean {
  const t = String(label ?? "").trim();
  if (t === IMPLEMENTATION_STAGE_NAVIGATE_LABEL || t === IMPLEMENTATION_SEED_CONFIRM_CTA_LABEL) {
    return true;
  }
  return implementationCandidateRefineApplyResultChips().includes(t);
}
