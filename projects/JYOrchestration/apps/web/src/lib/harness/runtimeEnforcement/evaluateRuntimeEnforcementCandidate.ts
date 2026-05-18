/**
 * H11 — 어떤 **enforcement 후보**가 메타데이터 상 허용 가능한지(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type {
  EnforcementCandidateMode,
  EnforcementCandidateRisk,
  RuntimeEnforcementCandidateReport,
} from "./runtimeEnforcementCandidateTypes";

function deriveCandidateMode(
  eligible: boolean,
  governanceApprovalDisabled: boolean,
  pressureCritical: boolean
): EnforcementCandidateMode {
  if (governanceApprovalDisabled || pressureCritical) return "disabled";
  if (eligible) return "candidate_only";
  return "planning_only";
}

function deriveRiskLevel(
  eligible: boolean,
  governanceRiskHigh: boolean,
  pressureHighOrCritical: boolean,
  releaseNotReady: boolean
): EnforcementCandidateRisk {
  if (!eligible && (governanceRiskHigh || pressureHighOrCritical || releaseNotReady)) return "high";
  if (!eligible || governanceRiskHigh) return "medium";
  return "low";
}

export function evaluateRuntimeEnforcementCandidate(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): RuntimeEnforcementCandidateReport {
  const pressure = evaluateResourcePressure(input.extract);
  const { trialReadiness, governance, rollbackSafety } = input.governanceCtx;

  const pressureCritical = pressure.pressureSeverity === "critical";
  const pressureHighOrCritical = pressure.pressureSeverity === "high" || pressureCritical;
  const releaseNotReady = input.releaseGate.readinessLevel === "not_ready";
  const trialNotPrepared = trialReadiness.readinessLevel === "not_prepared";
  const governanceApprovalDisabled = governance.approvalMode === "disabled";
  const governanceRiskHigh = governance.governanceRisk === "high";

  const explainabilityStable = input.messageExplainabilityAvailable === true && input.baseline.userVisibleSummaryReady;

  const candidateEligible =
    !governanceApprovalDisabled &&
    !pressureCritical &&
    !releaseNotReady &&
    trialReadiness.readinessLevel === "ready_for_documented_trial" &&
    input.releaseGate.readinessLevel === "candidate_for_manual_review" &&
    governance.operatorReviewReadiness !== "not_ready" &&
    rollbackSafety.rollbackRisk !== "high" &&
    explainabilityStable;

  const candidateMode = deriveCandidateMode(candidateEligible, governanceApprovalDisabled, pressureCritical);

  const riskLevel = deriveRiskLevel(candidateEligible, governanceRiskHigh, pressureHighOrCritical, releaseNotReady);

  const blockedCapabilities: string[] = [];
  if (releaseNotReady) blockedCapabilities.push("release_gate:not_ready");
  if (trialNotPrepared) blockedCapabilities.push("trial:not_prepared");
  if (governanceApprovalDisabled) blockedCapabilities.push("governance:approval_disabled");
  if (!explainabilityStable) blockedCapabilities.push("explainability:unstable");
  if (pressureCritical) blockedCapabilities.push("resource:pressure_critical");
  if (rollbackSafety.rollbackRisk === "high") blockedCapabilities.push("rollback:safety_high");

  const candidateCapabilities: string[] = [];
  if (candidateEligible) {
    candidateCapabilities.push(
      "provider_routing_candidate",
      "retrieval_orchestration_candidate",
      "execution_gating_candidate",
      "approval_gating_candidate",
      "rollback_candidate"
    );
  } else if (candidateMode === "planning_only") {
    candidateCapabilities.push("documentation_and_operator_review_only");
  }

  const recommendations: string[] = [
    "H11은 후보 capability 정의만 제공합니다. 실제 enable·routing·차단은 수행하지 않습니다.",
    "후보 허용 여부는 H10.5 governance·rollback·auditability 계획과 연동됩니다.",
  ];
  if (!candidateEligible) {
    recommendations.unshift("현재 조건에서는 enforcement 후보를 ‘적용 가능’으로 표시하지 않습니다.");
  }

  return {
    mode: "runtime_enforcement_candidate_planning",
    actualRuntimeEnforcementEnabled: false,
    candidateMode,
    candidateEligible,
    riskLevel,
    blockedCapabilities: blockedCapabilities.slice(0, 12),
    candidateCapabilities: candidateCapabilities.slice(0, 12),
    recommendations: recommendations.slice(0, 10),
    governanceDependencySummaryKo: `승인 모드 ${governance.approvalMode}, 운영 검토 ${governance.operatorReviewReadiness}, 거버넌스 리스크 ${governance.governanceRisk}`,
    rollbackDependencySummaryKo: `롤백 안전 등급 ${rollbackSafety.rollbackRisk}, 통제 시험 준비도 ${trialReadiness.readinessLevel}`,
  };
}

export function serializeRuntimeEnforcementCandidateForDiagnostic(
  report: RuntimeEnforcementCandidateReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeEnforcementEnabled: report.actualRuntimeEnforcementEnabled,
    candidateMode: report.candidateMode,
    candidateEligible: report.candidateEligible,
    riskLevel: report.riskLevel,
    blockedCapabilities: [...report.blockedCapabilities],
    candidateCapabilities: [...report.candidateCapabilities],
    recommendations: [...report.recommendations],
    governanceDependencySummaryKo: report.governanceDependencySummaryKo,
    rollbackDependencySummaryKo: report.rollbackDependencySummaryKo,
  };
}
