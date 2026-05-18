/**
 * H10.5 — Runtime **governance** 요약(read-only). 승인·강제·실행 없음.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeTrialReadinessReport } from "@/lib/harness/runtimeTrial/runtimeTrialTypes";
import type {
  RuntimeApprovalMode,
  RuntimeGovernanceAuditabilityLevel,
  RuntimeGovernanceRiskLevel,
  RuntimeGovernanceSummary,
  RuntimeOperatorReviewReadiness,
  RuntimeRollbackReadiness,
} from "./runtimeGovernanceTypes";

function deriveApprovalMode(
  trial: RuntimeTrialReadinessReport,
  releaseGate: HarnessReleaseGateReadinessReport,
  baseline: HarnessMaturityBaselineReport,
  pressureSeverity: string
): RuntimeApprovalMode {
  if (!baseline.controlledTrialReady && trial.readinessLevel === "not_prepared") {
    return "disabled";
  }
  if (trial.readinessLevel === "not_prepared" || releaseGate.readinessLevel === "not_ready") {
    return "manual_only";
  }
  if (pressureSeverity === "critical") {
    return "manual_only";
  }
  return "operator_review_required";
}

function deriveRollbackReadiness(
  trial: RuntimeTrialReadinessReport,
  releaseGate: HarnessReleaseGateReadinessReport,
  pressureSeverity: string
): RuntimeRollbackReadiness {
  if (trial.readinessLevel === "not_prepared" || releaseGate.readinessLevel === "not_ready") {
    return "not_ready";
  }
  if (trial.readinessLevel === "preparation_partial" || pressureSeverity === "high" || pressureSeverity === "critical") {
    return "planning_only";
  }
  if (
    trial.readinessLevel === "ready_for_documented_trial" &&
    releaseGate.readinessLevel === "candidate_for_manual_review" &&
    (pressureSeverity === "stable" || pressureSeverity === "elevated")
  ) {
    return "dry_run_ready";
  }
  return "planning_only";
}

function deriveAuditability(trial: RuntimeTrialReadinessReport): RuntimeGovernanceAuditabilityLevel {
  if (trial.readinessLevel === "not_prepared") return "none";
  if (trial.readinessLevel === "preparation_partial") return "basic_planning";
  return "extended_planning";
}

function deriveGovernanceRisk(
  trial: RuntimeTrialReadinessReport,
  releaseGate: HarnessReleaseGateReadinessReport,
  baseline: HarnessMaturityBaselineReport,
  pressureSeverity: string
): RuntimeGovernanceRiskLevel {
  if (
    trial.readinessLevel === "not_prepared" ||
    releaseGate.readinessLevel === "not_ready" ||
    pressureSeverity === "critical" ||
    baseline.missingCount > 0
  ) {
    return "high";
  }
  if (trial.readinessLevel === "preparation_partial" || pressureSeverity === "high" || pressureSeverity === "elevated") {
    return "medium";
  }
  return "low";
}

function deriveOperatorReviewReadiness(approval: RuntimeApprovalMode, trial: RuntimeTrialReadinessReport): RuntimeOperatorReviewReadiness {
  if (approval === "disabled") return "not_ready";
  if (approval === "manual_only") return trial.readinessLevel === "not_prepared" ? "not_ready" : "recommended";
  return "required";
}

export function buildRuntimeGovernanceSummary(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly trialReadiness: RuntimeTrialReadinessReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
}): RuntimeGovernanceSummary {
  const pressure = evaluateResourcePressure(input.extract);
  const approvalMode = deriveApprovalMode(
    input.trialReadiness,
    input.releaseGate,
    input.baseline,
    pressure.pressureSeverity
  );
  const rollbackReadiness = deriveRollbackReadiness(input.trialReadiness, input.releaseGate, pressure.pressureSeverity);
  const auditabilityLevel = deriveAuditability(input.trialReadiness);
  const governanceRisk = deriveGovernanceRisk(
    input.trialReadiness,
    input.releaseGate,
    input.baseline,
    pressure.pressureSeverity
  );
  const operatorReviewReadiness = deriveOperatorReviewReadiness(approvalMode, input.trialReadiness);

  const blockers: string[] = [];
  if (approvalMode === "disabled") {
    blockers.push("통제 시험 기준(controlledTrialReady)과 준비도가 맞지 않아 위임형 거버넌스 경로를 열지 않습니다.");
  }
  if (input.releaseGate.readinessLevel === "not_ready") {
    blockers.push("Release gate 미준비: 운영 승인 체인을 문서로만 정의하고 자동 위임은 금지합니다.");
  }
  if (input.trialReadiness.unstableHarnessLayers.length > 0) {
    blockers.push(
      `불안정·미완 maturity 계층 ${input.trialReadiness.unstableHarnessLayers.length}개가 남아 있습니다.`
    );
  }
  if (pressure.pressureSeverity === "critical") {
    blockers.push("자원 압력 심각: 승인·롤백은 수동·오프라인 절차로만 계획하세요.");
  }

  const recommendations: string[] = [
    "실제 승인 버튼·merge gate·실행 차단은 H10.5 범위 밖입니다.",
    "감사 대상 이벤트는 `runtimeAuditabilitySummary.plannedTraceTargets`를 참고해 정책만 수립하세요.",
    "롤백은 `rollbackSafetyPlanning`의 위험 등급을 바탕으로 문서·dry-run만 수행하세요.",
  ];
  if (operatorReviewReadiness === "required") {
    recommendations.unshift("운영자 검토(서명/티켓 등 외부 절차)를 전제로 한 시험 계획만 권장됩니다.");
  }

  return {
    mode: "controlled_runtime_governance_planning",
    actualGovernanceEnforcementEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualRollbackExecutionEnabled: false,
    approvalMode,
    rollbackReadiness,
    auditabilityLevel,
    governanceRisk,
    operatorReviewReadiness,
    blockers: blockers.slice(0, 8),
    recommendations: recommendations.slice(0, 8),
  };
}

export function serializeRuntimeGovernanceSummaryForDiagnostic(
  summary: RuntimeGovernanceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualGovernanceEnforcementEnabled: summary.actualGovernanceEnforcementEnabled,
    actualApprovalEnforcementEnabled: summary.actualApprovalEnforcementEnabled,
    actualRollbackExecutionEnabled: summary.actualRollbackExecutionEnabled,
    approvalMode: summary.approvalMode,
    rollbackReadiness: summary.rollbackReadiness,
    auditabilityLevel: summary.auditabilityLevel,
    governanceRisk: summary.governanceRisk,
    operatorReviewReadiness: summary.operatorReviewReadiness,
    blockers: [...summary.blockers],
    recommendations: [...summary.recommendations],
  };
}
