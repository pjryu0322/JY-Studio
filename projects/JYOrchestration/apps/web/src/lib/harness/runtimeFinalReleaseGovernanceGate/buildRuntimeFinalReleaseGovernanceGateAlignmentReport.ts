/**
 * H39.5 — final release governance gate **alignment report**(read-only; H40 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  FINAL_RELEASE_GOVERNANCE_GATE_REQUIRED_FORBIDDEN_SCOPE_FRAGMENTS,
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER,
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeFinalReleaseGovernanceGateConstants";
import {
  gateBlockersAligned,
  gateChecklistHasLabel,
  gateForbiddenIncludes,
  resolveFinalReleaseGovernanceGateAlignmentStatus,
} from "./runtimeFinalReleaseGovernanceGateCheckHelpers";
import type {
  RuntimeFinalReleaseGovernanceGateAlignmentReport,
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateReadinessChecklist,
  RuntimeFinalReleaseGovernanceGateScope,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateViolationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function buildRuntimeFinalReleaseGovernanceGateAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate;
  readonly summary: RuntimeFinalReleaseGovernanceGateSummary;
  readonly scope: RuntimeFinalReleaseGovernanceGateScope;
  readonly policy: RuntimeFinalReleaseGovernanceGatePolicy;
  readonly checklist: RuntimeFinalReleaseGovernanceGateReadinessChecklist;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
  readonly boundaryViolation: RuntimeFinalReleaseGovernanceGateViolationReport;
}): RuntimeFinalReleaseGovernanceGateAlignmentReport {
  const { reports, summary, scope, policy, checklist, blockerReport, boundaryViolation } = input;
  const releaseFinalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;
  const releaseViolation = reports.runtimeGovernanceReleaseReadinessViolationReport;
  const findings: string[] = [];

  if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    releaseFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("governance release-readiness final gate misaligned with final release governance gate summary");
  }
  if (scope.candidateSourceLayer !== FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER) {
    findings.push(`scope.candidateSourceLayer must be ${FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER}`);
  }
  if (scope.candidateTargetLayer !== FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER) {
    findings.push(`scope.candidateTargetLayer must be ${FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER}`);
  }
  for (const fragment of FINAL_RELEASE_GOVERNANCE_GATE_REQUIRED_FORBIDDEN_SCOPE_FRAGMENTS) {
    if (!gateForbiddenIncludes(scope.forbiddenGateOperations, fragment)) {
      findings.push(`scope.forbiddenGateOperations missing ${fragment}`);
    }
  }
  if (policy.gateAllowedMode !== summary.gateMode) {
    findings.push("policy.gateAllowedMode misaligned with summary.gateMode");
  }
  if (policy.actualExecutionForbidden !== true) {
    findings.push("policy.actualExecutionForbidden must be true");
  }
  if (policy.actualApprovalEnforcementForbidden !== true) {
    findings.push("policy.actualApprovalEnforcementForbidden must be true");
  }
  if (policy.actualExecutionBlockingForbidden !== true) {
    findings.push("policy.actualExecutionBlockingForbidden must be true");
  }
  if (policy.actualMergeBlockingForbidden !== true) {
    findings.push("policy.actualMergeBlockingForbidden must be true");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "governance release-readiness final gate ready_metadata")) {
    findings.push("readiness checklist missing governance release-readiness final gate row");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "no release-readiness actual flag violations")) {
    findings.push("readiness checklist missing no release-readiness actual flag violations row");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "no release-readiness proof violations")) {
    findings.push("readiness checklist missing no release-readiness proof violations row");
  }
  if (!gateBlockersAligned(blockerReport.blockers, summary.gateBlockers)) {
    findings.push("blocker report misaligned with summary.gateBlockers");
  }
  if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    (boundaryViolation.actualFlagViolations.length > 0 || boundaryViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("final_release_governance_gate_metadata_candidate requires empty gate violations");
  }
  if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    (releaseViolation.actualFlagViolations.length > 0 || releaseViolation.proofViolations.length > 0)
  ) {
    findings.push("final_release_governance_gate_metadata_candidate requires empty release-readiness violations");
  }

  const alignmentStatus = resolveFinalReleaseGovernanceGateAlignmentStatus(findings);

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H39.5: final release governance gate alignment aligned_metadata — H40 entry 후보(enforcement 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H39.5: final release governance gate alignment partial — scope·policy·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H39.5: final release governance gate alignment failed — violation·release-readiness final gate 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_final_release_governance_gate_alignment_report",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
