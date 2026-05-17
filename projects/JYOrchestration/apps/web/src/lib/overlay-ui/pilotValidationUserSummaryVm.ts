/**
 * Pilot Validation Phase 0/1 — 사용자용 파일럿 실행 검증 UI ViewModel contract.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationConstants";
import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";
import {
  PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO,
  PILOT_VALIDATION_USER_EXECUTION_SCOPE_KO,
  PILOT_VALIDATION_USER_PANEL_DESCRIPTION_KO,
  PILOT_VALIDATION_USER_STATUS_LABEL_KO,
} from "./pilotValidationUserUiLabelsKo";

export type PilotValidationUserSummaryStatusTone = "ready" | "watch" | "blocked" | "neutral";

export type PilotValidationUserSummaryVm = Readonly<{
  statusKo: string;
  executionScopeKo: string;
  allowedExecutionModeKo: string;
  isUserApprovalRequired: boolean;
  canRequestPilotValidation: boolean;
  cannotProceedReasonKo: string | null;
  safetySummaryRows: readonly string[];
  prohibitedOperationRows: readonly string[];
  primaryActionLabelKo: string;
  secondaryActionLabelKo: string;
  descriptionKo: string;
  statusTone: PilotValidationUserSummaryStatusTone;
  primaryActionEnabled: boolean;
  secondaryActionEnabled: boolean;
  dryRunOnlyNoticeKo: string;
}>;

function actionLabelsForStatus(status: RuntimePilotValidationReadOnlyChainStatus): Readonly<{
  primaryActionLabelKo: string;
  secondaryActionLabelKo: string;
}> {
  switch (status) {
    case "ready_for_validation":
      return {
        primaryActionLabelKo: "검증 결과 보기",
        secondaryActionLabelKo: "파일럿 실행 검증 준비",
      };
    case "watch":
      return {
        primaryActionLabelKo: "검증 결과 보기",
        secondaryActionLabelKo: "보완 요청",
      };
    case "blocked":
      return {
        primaryActionLabelKo: "차단 사유 보기",
        secondaryActionLabelKo: "AI 개발자에게 보완 요청",
      };
    default:
      return {
        primaryActionLabelKo: "준비 상태 보기",
        secondaryActionLabelKo: "작업 계속",
      };
  }
}

function statusToneForStatus(status: RuntimePilotValidationReadOnlyChainStatus): PilotValidationUserSummaryStatusTone {
  switch (status) {
    case "ready_for_validation":
      return "ready";
    case "watch":
      return "watch";
    case "blocked":
      return "blocked";
    default:
      return "neutral";
  }
}

function userFriendlyCannotProceedReason(
  status: RuntimePilotValidationReadOnlyChainStatus,
  summary: RuntimeSemanticPlanningReports["runtimePilotValidationReadOnlyChainSummary"]
): string | null {
  if (status === "blocked") {
    return summary.topBlockers[0] ?? "파일럿 검증이 차단되었습니다. 차단 사유를 확인한 뒤 보완해 주세요.";
  }
  if (status === "not_ready") {
    return "파일럿 검증을 시작하기 전 준비 단계가 더 필요합니다.";
  }
  if (status === "watch") {
    return summary.topWarnings[0] ?? "주의 항목을 확인한 뒤 보완이 필요할 수 있습니다.";
  }
  return null;
}

function userFriendlyAllowedExecutionModeKo(
  executionMode: RuntimeSemanticPlanningReports["runtimeControlledPilotExecutionCandidateSummary"]["executionMode"]
): string {
  if (executionMode === "metadata_only") {
    return "메타데이터 검증만 허용";
  }
  if (executionMode === "disabled") {
    return "실행 없음(검증 준비만)";
  }
  return "차단됨";
}

export function buildPilotValidationUserSummaryVmFromReports(
  reports: RuntimeSemanticPlanningReports
): PilotValidationUserSummaryVm {
  const summary = reports.runtimePilotValidationReadOnlyChainSummary;
  const candidate = reports.runtimeControlledPilotExecutionCandidateSummary;
  const policy = reports.runtimeControlledPilotExecutionCandidatePolicy;
  const approval = reports.runtimeOperatorApprovalSummary;

  const status = summary.validationStatus;
  const actions = actionLabelsForStatus(status);

  const isUserApprovalRequired =
    policy.operatorReviewBeforeControlledPilotExecution === true ||
    approval.approvalReadiness === "ready_for_review_metadata" ||
    approval.approvalReadiness === "review_required";

  const canRequestPilotValidation = status === "ready_for_validation";

  const cannotProceedReasonKo = userFriendlyCannotProceedReason(status, summary);

  return {
    statusKo: PILOT_VALIDATION_USER_STATUS_LABEL_KO[status],
    executionScopeKo: PILOT_VALIDATION_USER_EXECUTION_SCOPE_KO,
    allowedExecutionModeKo: userFriendlyAllowedExecutionModeKo(candidate.executionMode),
    isUserApprovalRequired,
    canRequestPilotValidation,
    cannotProceedReasonKo,
    safetySummaryRows: [summary.userVisibleSummaryKo, ...summary.finalProofSummary.slice(0, 3)],
    prohibitedOperationRows: PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO,
    ...actions,
    descriptionKo: PILOT_VALIDATION_USER_PANEL_DESCRIPTION_KO,
    statusTone: statusToneForStatus(status),
    primaryActionEnabled: true,
    secondaryActionEnabled: canRequestPilotValidation,
    dryRunOnlyNoticeKo: PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO,
  };
}
