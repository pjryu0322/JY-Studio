/** 사용자-facing 구현 단계 용어 (내부 generation 이름과 분리) */

export const IMPLEMENTATION_PHASE_LABEL = "구현 단계" as const;
export const IMPLEMENTATION_PROGRESS_LABEL = "구현 진행도" as const;
export const IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL = "구현 슬롯 상세" as const;
export const IMPLEMENTATION_ARTIFACT_HUB_LABEL = "구현 산출물" as const;
export const IMPLEMENTATION_START_LABEL = "구현 시작" as const;
export const IMPLEMENTATION_STAGE_NAVIGATE_LABEL = "구현단계로 이동" as const;
export const IMPLEMENTATION_PREP_READY_HEADING = "구현 준비 완료" as const;
export const IMPLEMENTATION_PREP_READY_COMPLETE_HEADING = "구현 준비가 완료되었습니다." as const;
export const IMPLEMENTATION_PREP_INFO_ORGANIZED_HEADING = "구현 준비정보를 정리했습니다." as const;

export const QUICK_DESIGN_CONFIRM_ACTION_LABEL = "Quick Design 확정" as const;

export const IMPLEMENTATION_ARTIFACT_VIEW_LABEL = "Artifact 보기" as const;
export const PLANNING_ARTIFACT_VIEW_LABEL = "산출물 보기" as const;
export const IMPLEMENTATION_REFINE_LABEL = "추가 보완" as const;
export const PLANNING_INFO_REFINE_LABEL = "기획정보 보완" as const;

export const PLANNING_IMPLEMENTATION_SEED_CHECK_LABEL = "구현 준비도 점검" as const;
export const PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_LABEL = "부족한 기획정보 보완" as const;
export const PLANNING_IMPLEMENTATION_SEED_GENERATE_LABEL = "AI팀이 구현 Seed 후보 생성" as const;
export const IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_LABEL = "Seed 후보 확인/확정" as const;
export const IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL = "구현 작업안 초안 생성" as const;
export const PLANNING_ENV_SETTINGS_LABEL = "환경설정 열기" as const;

/** Quick Design 확정 후 — 준비 완료 시 칩 순서 */
export const QUICK_DESIGN_POST_CONFIRM_CHIPS_READY: readonly string[] = [
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
] as const;

/** Quick Design 확정 후 — 후보 보완이 포함된 경우 칩 순서 */
export const QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW: readonly string[] = [
  PLANNING_INFO_REFINE_LABEL,
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
] as const;

export const ALL_QUICK_DESIGN_POST_CONFIRM_CHIP_LABELS: readonly string[] = [
  ...new Set([
    ...QUICK_DESIGN_POST_CONFIRM_CHIPS_READY,
    ...QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW,
  ]),
] as const;

/** @deprecated Quick Design 확정 메시지는 `quickDesignPostConfirmChipLabels` 사용 */
export const QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS = ALL_QUICK_DESIGN_POST_CONFIRM_CHIP_LABELS;

export function quickDesignPostConfirmChipLabels(input: {
  readonly prepComplete: boolean;
}): readonly string[] {
  return input.prepComplete
    ? [...QUICK_DESIGN_POST_CONFIRM_CHIPS_READY]
    : [...QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW];
}

export const ORCHESTRATION_PHASE_READY_FOR_IMPLEMENTATION = "READY_FOR_IMPLEMENTATION" as const;
export const ORCHESTRATION_PHASE_IMPLEMENTATION_RUNNING = "IMPLEMENTATION_RUNNING" as const;
