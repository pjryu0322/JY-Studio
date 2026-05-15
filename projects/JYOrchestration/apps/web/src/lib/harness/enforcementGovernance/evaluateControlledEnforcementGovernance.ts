/**
 * H11.5 — governance 조건에서만 허용 가능한 **enforcement 후보** 메타(read-only).
 */

import type { HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { CandidateCapabilityPlanningReport, RuntimeEnforcementCandidateReport } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import type {
  ControlledEnforcementGovernanceReport,
  EnforcementGovernanceMode,
} from "./controlledEnforcementGovernanceTypes";

const CANDIDATE_LABELS: Record<string, string> = {
  provider_routing_candidate: "프로바이더 라우팅 후보",
  retrieval_orchestration_candidate: "검색 오케스트레이션 후보",
  execution_gating_candidate: "실행 게이팅 후보",
  approval_gating_candidate: "승인 게이팅 후보",
  rollback_candidate: "롤백 후보",
};

function deriveGovernanceMode(
  candidateEligible: boolean,
  governanceApprovalDisabled: boolean,
  candidateMode: RuntimeEnforcementCandidateReport["candidateMode"]
): EnforcementGovernanceMode {
  if (governanceApprovalDisabled || candidateMode === "disabled") return "disabled";
  if (candidateEligible) return "candidate_only";
  return "planning_only";
}

export function evaluateControlledEnforcementGovernance(input: {
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly candidateReport: RuntimeEnforcementCandidateReport;
  readonly capabilityPlanning: CandidateCapabilityPlanningReport;
}): ControlledEnforcementGovernanceReport {
  const { governance, rollbackSafety, auditability, trialReadiness } = input.governanceCtx;

  const governanceApprovalDisabled = governance.approvalMode === "disabled";
  const governanceReadinessEligible =
    input.candidateReport.candidateEligible &&
    governance.approvalMode !== "disabled" &&
    governance.operatorReviewReadiness !== "not_ready" &&
    governance.governanceRisk !== "high" &&
    rollbackSafety.rollbackRisk !== "high" &&
    trialReadiness.readinessLevel === "ready_for_documented_trial";

  const governanceMode = deriveGovernanceMode(
    governanceReadinessEligible,
    governanceApprovalDisabled,
    input.candidateReport.candidateMode
  );

  const eligibleCandidates: string[] = [];
  const blockedCandidates: string[] = [...input.candidateReport.blockedCapabilities];

  for (const row of input.capabilityPlanning.rows) {
    const code = row.kind;
    const label = row.labelKo;
    if (row.status === "candidate" && governanceReadinessEligible) {
      eligibleCandidates.push(label);
    } else if (row.status === "blocked") {
      blockedCandidates.push(`${code}:blocked`);
    }
  }

  if (input.candidateReport.candidateEligible && eligibleCandidates.length === 0) {
    for (const cap of input.candidateReport.candidateCapabilities) {
      eligibleCandidates.push(CANDIDATE_LABELS[cap] ?? cap);
    }
  }

  const requiredGovernanceConditions: string[] = [];
  if (governance.operatorReviewReadiness === "required") {
    requiredGovernanceConditions.push("operator_review:required");
  }
  if (governance.approvalMode === "manual_only") {
    requiredGovernanceConditions.push("approval:manual_only");
  }
  if (governance.approvalMode === "operator_review_required") {
    requiredGovernanceConditions.push("approval:operator_review_required");
  }
  if (governance.governanceRisk === "high" || governance.governanceRisk === "medium") {
    requiredGovernanceConditions.push(`governance_risk:${governance.governanceRisk}`);
  }
  if (input.releaseGate.readinessLevel !== "candidate_for_manual_review") {
    requiredGovernanceConditions.push(`release_gate:${input.releaseGate.readinessLevel}`);
  }

  const requiredRollbackConditions: string[] = [];
  if (rollbackSafety.rollbackRisk === "high") {
    requiredRollbackConditions.push("rollback_safety:high");
  } else if (rollbackSafety.rollbackRisk === "watch") {
    requiredRollbackConditions.push("rollback_safety:watch");
  }
  if (governance.rollbackReadiness === "not_ready") {
    requiredRollbackConditions.push("rollback_readiness:not_ready");
  } else if (governance.rollbackReadiness === "planning_only") {
    requiredRollbackConditions.push("rollback_readiness:planning_only");
  }

  const requiredAuditabilityConditions: string[] = [];
  if (governance.auditabilityLevel === "none") {
    requiredAuditabilityConditions.push("auditability:plan_before_candidate");
  }
  if (auditability.plannedTraceTargets.length > 0) {
    requiredAuditabilityConditions.push("auditability:trace_targets_documented");
  }

  const recommendations: string[] = [
    "H11.5는 governance 조건 기반 후보 readiness만 정의합니다. 실제 enforcement·enable 버튼은 없습니다.",
    "후보 허용은 H10.5 governance·rollback·auditability 계획과 H11 enforcement candidate를 함께 봅니다.",
  ];
  if (!governanceReadinessEligible) {
    recommendations.unshift("현재 governance 조건에서는 enforcement 후보를 ‘허용 가능’으로 표시하지 않습니다.");
  }

  return {
    mode: "controlled_enforcement_governance_planning",
    actualEnforcementGovernanceEnabled: false,
    governanceMode,
    governanceReadinessEligible,
    eligibleCandidates: eligibleCandidates.slice(0, 12),
    blockedCandidates: [...new Set(blockedCandidates)].slice(0, 12),
    requiredGovernanceConditions: requiredGovernanceConditions.slice(0, 10),
    requiredRollbackConditions: requiredRollbackConditions.slice(0, 8),
    requiredAuditabilityConditions: requiredAuditabilityConditions.slice(0, 8),
    recommendations: recommendations.slice(0, 10),
  };
}

export function serializeControlledEnforcementGovernanceForDiagnostic(
  report: ControlledEnforcementGovernanceReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualEnforcementGovernanceEnabled: report.actualEnforcementGovernanceEnabled,
    governanceMode: report.governanceMode,
    governanceReadinessEligible: report.governanceReadinessEligible,
    eligibleCandidates: [...report.eligibleCandidates],
    blockedCandidates: [...report.blockedCandidates],
    requiredGovernanceConditions: [...report.requiredGovernanceConditions],
    requiredRollbackConditions: [...report.requiredRollbackConditions],
    requiredAuditabilityConditions: [...report.requiredAuditabilityConditions],
    recommendations: [...report.recommendations],
  };
}
