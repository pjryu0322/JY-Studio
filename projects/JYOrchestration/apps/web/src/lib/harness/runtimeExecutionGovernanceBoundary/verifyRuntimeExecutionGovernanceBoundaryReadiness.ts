/**
 * H37.5 — governance boundary scope·policy·checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { governanceChecklistHas } from "./runtimeExecutionGovernanceBoundaryCheckHelpers";
import type {
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryPolicy,
  RuntimeExecutionGovernanceBoundaryReadinessChecklist,
  RuntimeExecutionGovernanceBoundaryReadinessVerificationReport,
  RuntimeExecutionGovernanceBoundaryScope,
  RuntimeExecutionGovernanceBoundarySummary,
} from "./runtimeExecutionGovernanceBoundaryTypes";

function blockersAligned(
  blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport,
  summary: RuntimeExecutionGovernanceBoundarySummary
): boolean {
  if (blockerReport.blockers.length === 0 && summary.governanceBlockers.length === 0) {
    return true;
  }
  if (blockerReport.blockers.length > 0) {
    return blockerReport.blockers.every((b) => summary.governanceBlockers.includes(b));
  }
  return true;
}

export function verifyRuntimeExecutionGovernanceBoundaryReadiness(input: {
  readonly summary: RuntimeExecutionGovernanceBoundarySummary;
  readonly scope: RuntimeExecutionGovernanceBoundaryScope;
  readonly policy: RuntimeExecutionGovernanceBoundaryPolicy;
  readonly checklist: RuntimeExecutionGovernanceBoundaryReadinessChecklist;
  readonly blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
}): RuntimeExecutionGovernanceBoundaryReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.candidateSourceLayer !== "runtimeExecutionBoundaryShellFinalSafetyGate") {
    findings.push("scope.candidateSourceLayer must be runtimeExecutionBoundaryShellFinalSafetyGate");
  }
  if (scope.candidateTargetLayer !== "finalExecutionGovernanceBoundaryCandidate") {
    findings.push("scope.candidateTargetLayer must be finalExecutionGovernanceBoundaryCandidate");
  }
  if (scope.forbiddenGovernanceOperations.length === 0) {
    findings.push("scope.forbiddenGovernanceOperations must be non-empty");
  }
  if (policy.actualExecutionForbidden !== true) {
    findings.push("policy.actualExecutionForbidden must be true");
  }
  if (policy.actualExecutionRoutingForbidden !== true) {
    findings.push("policy.actualExecutionRoutingForbidden must be true");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    findings.push("policy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    findings.push("policy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    findings.push("policy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.actualProviderRoutingForbidden !== true) {
    findings.push("policy.actualProviderRoutingForbidden must be true");
  }
  if (policy.actualQueueControlForbidden !== true) {
    findings.push("policy.actualQueueControlForbidden must be true");
  }
  if (policy.actualRollbackForbidden !== true) {
    findings.push("policy.actualRollbackForbidden must be true");
  }
  if (policy.actualApprovalEnforcementForbidden !== true) {
    findings.push("policy.actualApprovalEnforcementForbidden must be true");
  }
  if (policy.governanceAllowedMode !== summary.governanceMode) {
    findings.push("policy.governanceAllowedMode must match summary.governanceMode");
  }
  if (!governanceChecklistHas(checklist.checklist, "execution boundary shell final gate ready_metadata", true)) {
    findings.push("checklist missing execution boundary shell final gate ready_metadata");
  }
  if (!governanceChecklistHas(checklist.checklist, "h37 entry readiness ready_metadata", true)) {
    findings.push("checklist missing h37 entry readiness ready_metadata");
  }
  if (
    !governanceChecklistHas(
      checklist.checklist,
      "execution boundary shell readiness verification verified_metadata",
      true
    )
  ) {
    findings.push("checklist missing execution boundary shell readiness verification verified_metadata");
  }
  if (!governanceChecklistHas(checklist.checklist, "execution boundary shell alignment aligned_metadata", true)) {
    findings.push("checklist missing execution boundary shell alignment aligned_metadata");
  }
  if (!governanceChecklistHas(checklist.checklist, "actual execution disabled", true)) {
    findings.push("checklist missing actual execution disabled");
  }
  if (!governanceChecklistHas(checklist.checklist, "actual execution routing disabled", true)) {
    findings.push("checklist missing actual execution routing disabled");
  }
  if (!governanceChecklistHas(checklist.checklist, "actual release enforcement disabled", true)) {
    findings.push("checklist missing actual release enforcement disabled");
  }
  if (!governanceChecklistHas(checklist.checklist, "actual approval enforcement disabled", true)) {
    findings.push("checklist missing actual approval enforcement disabled");
  }
  if (!blockersAligned(blockerReport, summary)) {
    findings.push("blocker report and summary.governanceBlockers misaligned");
  }
  if (
    summary.candidateStatus === "governance_boundary_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.governanceBlockers.length > 0)
  ) {
    findings.push("governance_boundary_metadata_candidate requires no governance blockers");
  }
  if (
    summary.candidateStatus === "blocked" &&
    blockerReport.blockers.length === 0 &&
    summary.governanceBlockers.length === 0
  ) {
    findings.push("blocked candidateStatus requires governance blockers");
  }

  let verificationStatus: RuntimeExecutionGovernanceBoundaryReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("policy.governanceAllowedMode must match") ||
        f.includes("policy.actualExecutionForbidden") ||
        f.includes("policy.actualExecutionRoutingForbidden") ||
        f.includes("policy.actualApprovalEnforcementForbidden") ||
        f.includes("blocked candidateStatus requires governance blockers") ||
        f.includes("governance_boundary_metadata_candidate requires no governance blockers")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H37.5: governance boundary readiness verified_metadata — H38 entry governance 후보(집행 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H37.5: governance boundary readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H37.5: governance boundary readiness failed — policy·blocker·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_governance_boundary_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualApprovalEnforcementEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
