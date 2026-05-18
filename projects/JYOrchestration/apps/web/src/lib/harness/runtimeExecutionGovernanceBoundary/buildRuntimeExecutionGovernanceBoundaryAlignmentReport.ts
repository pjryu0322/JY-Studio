/**
 * H37.5 — governance boundary **alignment report**(read-only; H38 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  governanceChecklistHasLabel,
  governanceForbiddenIncludes,
} from "./runtimeExecutionGovernanceBoundaryCheckHelpers";
import type {
  RuntimeExecutionGovernanceBoundaryAlignmentReport,
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryPolicy,
  RuntimeExecutionGovernanceBoundaryReadinessChecklist,
  RuntimeExecutionGovernanceBoundaryScope,
  RuntimeExecutionGovernanceBoundarySummary,
  RuntimeExecutionGovernanceBoundaryViolationReport,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function buildRuntimeExecutionGovernanceBoundaryAlignmentReport(input: {
  readonly summary: RuntimeExecutionGovernanceBoundarySummary;
  readonly scope: RuntimeExecutionGovernanceBoundaryScope;
  readonly policy: RuntimeExecutionGovernanceBoundaryPolicy;
  readonly checklist: RuntimeExecutionGovernanceBoundaryReadinessChecklist;
  readonly blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
  readonly boundaryViolation: RuntimeExecutionGovernanceBoundaryViolationReport;
}): RuntimeExecutionGovernanceBoundaryAlignmentReport {
  const { summary, scope, policy, checklist, blockerReport, boundaryViolation } = input;
  const findings: string[] = [];

  if (scope.candidateSourceLayer !== "runtimeExecutionBoundaryShellFinalSafetyGate") {
    findings.push("scope.candidateSourceLayer must be runtimeExecutionBoundaryShellFinalSafetyGate");
  }
  if (scope.candidateTargetLayer !== "finalExecutionGovernanceBoundaryCandidate") {
    findings.push("scope.candidateTargetLayer must be finalExecutionGovernanceBoundaryCandidate");
  }
  if (!governanceForbiddenIncludes(scope.forbiddenGovernanceOperations, "actual execution")) {
    findings.push("scope.forbiddenGovernanceOperations missing actual execution");
  }
  if (!governanceForbiddenIncludes(scope.forbiddenGovernanceOperations, "actual execution routing")) {
    findings.push("scope.forbiddenGovernanceOperations missing actual execution routing");
  }
  if (!governanceForbiddenIncludes(scope.forbiddenGovernanceOperations, "release enforcement")) {
    findings.push("scope.forbiddenGovernanceOperations missing release enforcement");
  }
  if (!governanceForbiddenIncludes(scope.forbiddenGovernanceOperations, "approval enforcement")) {
    findings.push("scope.forbiddenGovernanceOperations missing approval enforcement");
  }
  if (policy.governanceAllowedMode !== summary.governanceMode) {
    findings.push("policy.governanceAllowedMode misaligned with summary.governanceMode");
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
  if (policy.actualApprovalEnforcementForbidden !== true) {
    findings.push("policy.actualApprovalEnforcementForbidden must be true");
  }
  if (!governanceChecklistHasLabel(checklist.checklist, "execution boundary shell final gate ready_metadata")) {
    findings.push("readiness checklist missing boundary shell final gate row");
  }
  if (!governanceChecklistHasLabel(checklist.checklist, "h37 entry readiness ready_metadata")) {
    findings.push("readiness checklist missing h37 entry readiness row");
  }
  if (!governanceChecklistHasLabel(checklist.checklist, "execution boundary shell alignment aligned_metadata")) {
    findings.push("readiness checklist missing boundary shell alignment row");
  }
  if (blockerReport.blockers.length > 0) {
    const misaligned = blockerReport.blockers.some((b) => !summary.governanceBlockers.includes(b));
    if (misaligned) {
      findings.push("blocker report misaligned with summary.governanceBlockers");
    }
  }
  if (
    summary.candidateStatus === "governance_boundary_metadata_candidate" &&
    boundaryViolation.actualFlagViolations.length > 0
  ) {
    findings.push("governance_boundary_metadata_candidate requires empty boundary actual flag violations");
  }

  let alignmentStatus: RuntimeExecutionGovernanceBoundaryAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("policy.actualExecutionForbidden") ||
        f.includes("policy.actualExecutionRoutingForbidden") ||
        f.includes("policy.actualApprovalEnforcementForbidden") ||
        f.includes("empty boundary actual flag violations") ||
        f.includes("policy.governanceAllowedMode misaligned")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H37.5: governance boundary alignment aligned_metadata — H38 entry governance 후보(집행 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H37.5: governance boundary alignment partial — scope·forbidden·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H37.5: governance boundary alignment failed — policy·blocker·violation 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_governance_boundary_alignment_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualApprovalEnforcementEnabled: false,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
