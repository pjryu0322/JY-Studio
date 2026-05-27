import { IMPLEMENTATION_STAGE_NAVIGATE_LABEL } from "@/lib/requirements/implementationUxLabels";
import type { ImplementationCandidateRefineResultItem } from "@/lib/requirements/implementationCandidateRefineResult";

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
] as const;

export type ImplementationCandidateRefineCtaAction =
  | "apply_all"
  | "apply_selected"
  | "edit_by_item"
  | "view_needs_confirmation"
  | "review_again"
  | "review_later";

export function resolveImplementationCandidateRefineCtaAction(
  label: string,
): ImplementationCandidateRefineCtaAction | null {
  const t = String(label ?? "").trim();
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

export function implementationCandidateRefineApplyResultChips(): readonly string[] {
  return [
    IMPLEMENTATION_CANDIDATE_VIEW_NEEDS_CONFIRMATION_LABEL,
    IMPLEMENTATION_CANDIDATE_EDIT_BY_ITEM_LABEL,
    IMPLEMENTATION_CANDIDATE_REVIEW_AGAIN_LABEL,
    IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
    IMPLEMENTATION_CANDIDATE_REVIEW_LATER_LABEL,
  ];
}

export function isImplementationCandidateRefineApplyResultCtaLabel(label: string): boolean {
  const t = String(label ?? "").trim();
  return implementationCandidateRefineApplyResultChips().includes(t);
}

export function buildNeedsConfirmationOnlyViewMessage(
  items: readonly ImplementationCandidateRefineResultItem[],
): string | null {
  const pending = items.filter((i) => i.nextActionLabel === "추가 확인");
  if (!pending.length) return null;
  const lines = pending.map((i) => `- ${i.label}: ${i.refinedValue}`);
  return [
    "추가 확인이 필요한 기획정보 후보 항목입니다.",
    "",
    ...lines,
    "",
    "항목별 수정 또는 다시 검토를 선택해 주세요.",
  ].join("\n");
}
