/** 사용자-facing 구현 단계 용어 (내부 generation 이름과 분리) */

export const IMPLEMENTATION_PHASE_LABEL = "구현 단계" as const;
export const IMPLEMENTATION_START_LABEL = "구현 시작" as const;
export const IMPLEMENTATION_PREP_READY_HEADING = "구현 준비 완료" as const;

export const QUICK_DESIGN_CONFIRM_ACTION_LABEL = "Quick Design 확정" as const;

export const IMPLEMENTATION_ARTIFACT_VIEW_LABEL = "Artifact 보기" as const;
export const IMPLEMENTATION_REFINE_LABEL = "추가 보완" as const;

export const QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS: readonly string[] = [
  IMPLEMENTATION_ARTIFACT_VIEW_LABEL,
  IMPLEMENTATION_START_LABEL,
  IMPLEMENTATION_REFINE_LABEL,
] as const;

export const ORCHESTRATION_PHASE_READY_FOR_IMPLEMENTATION = "READY_FOR_IMPLEMENTATION" as const;
export const ORCHESTRATION_PHASE_IMPLEMENTATION_RUNNING = "IMPLEMENTATION_RUNNING" as const;
