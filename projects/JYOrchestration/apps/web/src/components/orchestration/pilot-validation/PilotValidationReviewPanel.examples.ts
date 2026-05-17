import type { PilotValidationUserSummaryVm } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import {
  PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO,
  PILOT_VALIDATION_USER_EXECUTION_SCOPE_KO,
  PILOT_VALIDATION_USER_PANEL_DESCRIPTION_KO,
  PILOT_VALIDATION_USER_STATUS_LABEL_KO,
} from "@/lib/overlay-ui/pilotValidationUserUiLabelsKo";
import { PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationConstants";

const baseVm: PilotValidationUserSummaryVm = {
  statusKo: "",
  executionScopeKo: PILOT_VALIDATION_USER_EXECUTION_SCOPE_KO,
  allowedExecutionModeKo: "메타데이터 검증만 허용",
  isUserApprovalRequired: false,
  canRequestPilotValidation: false,
  cannotProceedReasonKo: null,
  safetySummaryRows: ["read-only chain 검증 요약 예시"],
  prohibitedOperationRows: PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO,
  primaryActionLabelKo: "검증 결과 보기",
  secondaryActionLabelKo: "보완 요청",
  descriptionKo: PILOT_VALIDATION_USER_PANEL_DESCRIPTION_KO,
  statusTone: "neutral",
  primaryActionEnabled: true,
  secondaryActionEnabled: false,
  dryRunOnlyNoticeKo: PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO,
};

export const pilotValidationReviewPanelExampleVms = {
  ready_for_validation: {
    ...baseVm,
    statusKo: PILOT_VALIDATION_USER_STATUS_LABEL_KO.ready_for_validation,
    statusTone: "ready",
    canRequestPilotValidation: true,
    secondaryActionEnabled: true,
    secondaryActionLabelKo: "파일럿 실행 검증 준비",
  },
  watch: {
    ...baseVm,
    statusKo: PILOT_VALIDATION_USER_STATUS_LABEL_KO.watch,
    statusTone: "watch",
    cannotProceedReasonKo: "주의 항목을 확인한 뒤 보완이 필요할 수 있습니다.",
    secondaryActionLabelKo: "보완 요청",
    secondaryActionEnabled: false,
  },
  blocked: {
    ...baseVm,
    statusKo: PILOT_VALIDATION_USER_STATUS_LABEL_KO.blocked,
    statusTone: "blocked",
    cannotProceedReasonKo: "파일럿 검증이 차단되었습니다.",
    primaryActionLabelKo: "차단 사유 보기",
    secondaryActionLabelKo: "AI 개발자에게 보완 요청",
    secondaryActionEnabled: false,
  },
  not_ready: {
    ...baseVm,
    statusKo: PILOT_VALIDATION_USER_STATUS_LABEL_KO.not_ready,
    primaryActionLabelKo: "준비 상태 보기",
    secondaryActionLabelKo: "작업 계속",
    cannotProceedReasonKo: "파일럿 검증을 시작하기 전 준비 단계가 더 필요합니다.",
  },
} as const satisfies Record<string, PilotValidationUserSummaryVm>;
