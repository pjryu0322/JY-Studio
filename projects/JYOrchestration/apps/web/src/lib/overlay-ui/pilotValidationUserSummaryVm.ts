/**
 * Pilot Validation Phase 0 — 사용자용 파일럿 실행 검증 UI ViewModel contract.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationConstants";
import { RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_STATUS_LABEL_KO } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationLabelsKo";
import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";

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

  const cannotProceedReasonKo =
    status === "blocked"
      ? summary.topBlockers[0] ?? "pilot validation entry 차단"
      : status === "not_ready"
        ? "controlled pilot execution candidate final safety gate 선행 필요"
        : status === "watch"
          ? summary.topWarnings[0] ?? "verification·alignment·wording risk 재검토"
          : null;

  return {
    statusKo: RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_STATUS_LABEL_KO[status],
    executionScopeKo: "H20.5~H45.5 read-only metadata chain (pilot activation·execution 없음)",
    allowedExecutionModeKo:
      candidate.executionMode === "metadata_only"
        ? "metadata_only (검증 메타데이터)"
        : candidate.executionMode === "disabled"
          ? "disabled (실행 없음)"
          : "blocked",
    isUserApprovalRequired,
    canRequestPilotValidation,
    cannotProceedReasonKo,
    safetySummaryRows: [summary.userVisibleSummaryKo, ...summary.finalProofSummary.slice(0, 3)],
    prohibitedOperationRows: PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO,
    ...actions,
  };
}
