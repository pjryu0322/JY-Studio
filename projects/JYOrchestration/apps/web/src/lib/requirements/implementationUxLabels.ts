import type { ImplementationSurfaceReadiness } from "@/lib/requirements/implementationReadinessGates";

/** 사용자-facing 구현 단계 용어 (내부 generation 이름과 분리) */

export const IMPLEMENTATION_PHASE_LABEL = "구현 단계" as const;
export const IMPLEMENTATION_PROGRESS_LABEL = "구현 진행도" as const;
export const IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL = "구현 슬롯 상세" as const;
export const IMPLEMENTATION_ARTIFACT_HUB_LABEL = "구현 산출물" as const;
export const IMPLEMENTATION_START_LABEL = "구현 시작" as const;
export const IMPLEMENTATION_STAGE_NAVIGATE_LABEL = "구현단계로 이동" as const;
export const IMPLEMENTATION_PREP_READY_HEADING = "구현 준비 완료" as const;
export const IMPLEMENTATION_PREP_INFO_ORGANIZED_HEADING = "구현 준비정보를 정리했습니다." as const;

export const QUICK_DESIGN_IMPLEMENTATION_READY_WITH_ENV_HEADING =
  "구현 작업 준비가 완료되었습니다." as const;
export const QUICK_DESIGN_PLANNING_SEED_READY_HEADING = "기획/Seed 준비가 완료되었습니다." as const;
export const QUICK_DESIGN_IMPLEMENTATION_SEED_NEEDS_REVIEW_HEADING =
  "구현 준비정보를 정리했습니다." as const;

export const QUICK_DESIGN_CONFIRM_ACTION_LABEL = "Quick Design 확정" as const;
export const CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_LABEL =
  "초안 기준 구현 Seed 생성" as const;
export const START_QUICK_DESIGN_FROM_IMPLEMENTATION_LABEL = "기획단계에서 Quick Design 시작" as const;

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
/** 구현 단계·기획 단계 공통 실행 환경 칩 */
export const IMPLEMENTATION_ENV_SETTINGS_LABEL = PLANNING_ENV_SETTINGS_LABEL;

export const IMPLEMENTATION_ARTIFACT_REVIEW_LABEL = "산출물 다시 보기" as const;

export const AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP = "AI 개발자에게 구현 요청" as const;
export const AI_DEVELOPER_REMEDIATION_REQUEST_CHIP = "AI 개발자에게 보완 요청" as const;
export const TASK_LIST_VIEW_CHIP = "작업목록 보기" as const;
export const DESIGNER_REVIEW_CHIP = "디자이너 검토" as const;
export const REVIEWER_CHECK_CHIP = "검수자 점검" as const;
export const REVIEWER_CHECK_RUN_CHIP = "검수자 점검 실행" as const;
export const SECURITY_CHECK_CHIP = "보안 점검" as const;
export const SECURITY_CHECK_RUN_CHIP = "보안 점검 실행" as const;
export const SCM_CRITERIA_CHIP = "SCM 반영 기준 보기" as const;
export const GENERATE_IMPLEMENTATION_TASK_LIST_CHIP = "구현 작업목록 생성" as const;
export const IMPLEMENTATION_RETURN_TO_PLANNING_CHIP = "기획단계로 이동" as const;
export const IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP = "프로토타입 미리보기" as const;
export const IMPLEMENTATION_QUICK_RUN_CHIP = "선택한 CodeTask 실행" as const;
export const IMPLEMENTATION_QUICK_RUN_REFRESH_CHIP = "상태 새로고침" as const;
export const IMPLEMENTATION_PREVIEW_OPEN_CHIP = "Preview 열기" as const;
export const IMPLEMENTATION_ADD_INSTRUCTION_CHIP = "추가 지시 입력" as const;
export const IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP = "역할별 점검 보기" as const;
export const IMPLEMENTATION_GENERATION_REQUEST_CHIP = "생성요청" as const;
export const IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP = "사용자 확인 필요 항목 보기" as const;
/** @deprecated — use IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP */
export const IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP = "사용자 확인 처리" as const;
export const IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP = "사용자 확인 전체 처리" as const;
export const MOVE_TO_REVIEW_STAGE_CHIP = "검토단계로 이동" as const;
export const REVIEW_STAGE_OPEN_PREVIEW_CHIP = "프로토타입 열기" as const;
export const REVIEW_STAGE_START_USER_TEST_CHIP = "사용자 테스트 시작" as const;
export const REVIEW_STAGE_ADD_FEEDBACK_CHIP = "피드백 등록" as const;
export const REVIEW_STAGE_VIEW_FEEDBACK_CHIP = "피드백 보기" as const;
export const REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP = "구현단계 보완 요청" as const;
export const REVIEW_STAGE_COMPLETE_TEST_CHIP = "검토 완료" as const;
export const REQUEST_TASK_REWORK_CHIP = "작업 재작업 요청" as const;
export const IMPLEMENTATION_EXECUTION_BOARD_CHIP = "구현 작업 보드" as const;
export const RUN_REFACTOR_COMMON_CHIP = "리팩토링/공통화 실행" as const;
export const RUN_INTEGRATED_REVIEW_CHIP = "통합 검수 실행" as const;
export const RUN_INTEGRATED_SECURITY_CHIP = "통합 보안 점검 실행" as const;
export const RUN_FINAL_SCM_CHIP = "최종 SCM 반영 실행" as const;
export const RUN_PLATFORM_SCM_MERGE_CHIP = "PR Merge 실행" as const;

const TASK_LIST_ENTRY_SECONDARY_CHIPS: readonly string[] = [
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  TASK_LIST_VIEW_CHIP,
  DESIGNER_REVIEW_CHIP,
  REVIEWER_CHECK_CHIP,
  SECURITY_CHECK_CHIP,
  SCM_CRITERIA_CHIP,
  IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
] as const;

/** env 미완료 시 환경설정 칩을 앞에 둔 복사본 */
export function orderChipLabelsWithEnvFirst(
  chips: readonly string[],
  envOk: boolean,
  envLabel: string = IMPLEMENTATION_ENV_SETTINGS_LABEL,
): readonly string[] {
  if (envOk) return [...chips];
  const withoutEnv = chips.filter((c) => c !== envLabel);
  return [envLabel, ...withoutEnv];
}

export function implementationTaskListEntryChipLabels(input: { readonly envOk: boolean }): readonly string[] {
  if (!input.envOk) {
    return orderChipLabelsWithEnvFirst(
      [TASK_LIST_VIEW_CHIP, IMPLEMENTATION_ARTIFACT_REVIEW_LABEL],
      false,
    );
  }
  return [
    IMPLEMENTATION_GENERATION_REQUEST_CHIP,
    AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
    ...TASK_LIST_ENTRY_SECONDARY_CHIPS,
  ];
}

export function implementationTaskListMissingEntryChipLabels(input?: {
  readonly canGenerateFromSeed?: boolean;
}): readonly string[] {
  if (input?.canGenerateFromSeed) {
    return [
      GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
      IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
      IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
    ];
  }
  return [
    IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
    IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
  ];
}

/** Quick Design 확정 후 — seed·design·env·산출물 모두 준비 */
export const QUICK_DESIGN_POST_CONFIRM_CHIPS_FULLY_READY: readonly string[] = [
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
] as const;

/** Quick Design 확정 후 — Seed 확정됐으나 실행 환경 미완료 */
export const QUICK_DESIGN_POST_CONFIRM_CHIPS_SEED_READY_ENV_PENDING: readonly string[] = [
  PLANNING_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
] as const;

/** Quick Design 확정 후 — Seed·산출물 보완 필요 */
export const QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW: readonly string[] = [
  PLANNING_INFO_REFINE_LABEL,
  IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_LABEL,
  PLANNING_ARTIFACT_VIEW_LABEL,
] as const;

export const ALL_QUICK_DESIGN_POST_CONFIRM_CHIP_LABELS: readonly string[] = [
  ...new Set([
    ...QUICK_DESIGN_POST_CONFIRM_CHIPS_FULLY_READY,
    ...QUICK_DESIGN_POST_CONFIRM_CHIPS_SEED_READY_ENV_PENDING,
    ...QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW,
  ]),
] as const;

export function quickDesignPostConfirmChipLabelsForState(
  input: ImplementationSurfaceReadiness,
): readonly string[] {
  if (!input.hasReferenceArtifacts || !input.designOk || !input.seedReady) {
    return [...QUICK_DESIGN_POST_CONFIRM_CHIPS_NEEDS_REVIEW];
  }
  if (!input.envOk) {
    return [...QUICK_DESIGN_POST_CONFIRM_CHIPS_SEED_READY_ENV_PENDING];
  }
  return [...QUICK_DESIGN_POST_CONFIRM_CHIPS_FULLY_READY];
}

export const ORCHESTRATION_PHASE_READY_FOR_IMPLEMENTATION = "READY_FOR_IMPLEMENTATION" as const;
export const ORCHESTRATION_PHASE_IMPLEMENTATION_RUNNING = "IMPLEMENTATION_RUNNING" as const;
