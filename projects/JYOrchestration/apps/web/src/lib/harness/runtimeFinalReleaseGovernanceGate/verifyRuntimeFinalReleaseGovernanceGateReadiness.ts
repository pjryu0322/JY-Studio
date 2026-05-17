/**
 * H39.5 — final release governance gate **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER,
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeFinalReleaseGovernanceGateConstants";
import {
  gateBlockersAligned,
  gateChecklistHas,
  gateChecklistHasLabel,
  gateForbiddenIncludes,
  resolveFinalReleaseGovernanceGateVerificationStatus,
} from "./runtimeFinalReleaseGovernanceGateCheckHelpers";
import type {
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateReadinessChecklist,
  RuntimeFinalReleaseGovernanceGateScope,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateVerificationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function verifyRuntimeFinalReleaseGovernanceGateReadiness(input: {
  readonly summary: RuntimeFinalReleaseGovernanceGateSummary;
  readonly scope: RuntimeFinalReleaseGovernanceGateScope;
  readonly policy: RuntimeFinalReleaseGovernanceGatePolicy;
  readonly checklist: RuntimeFinalReleaseGovernanceGateReadinessChecklist;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
}): RuntimeFinalReleaseGovernanceGateVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    summary.gateMode !== "metadata_only"
  ) {
    findings.push("final_release_governance_gate_metadata_candidate requires gateMode metadata_only");
  }
  if (summary.candidateStatus === "blocked" && summary.gateBlockers.length === 0) {
    findings.push("blocked candidateStatus requires gateBlockers");
  }
  if (scope.candidateSourceLayer !== FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER) {
    findings.push(`scope.candidateSourceLayer must be ${FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER}`);
  }
  if (scope.candidateTargetLayer !== FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER) {
    findings.push(`scope.candidateTargetLayer must be ${FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER}`);
  }
  if (scope.forbiddenGateOperations.length === 0) {
    findings.push("scope.forbiddenGateOperations must be non-empty");
  }
  if (policy.gateAllowedMode !== summary.gateMode) {
    findings.push("policy.gateAllowedMode must match summary.gateMode");
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
  if (policy.actualExecutionBlockingForbidden !== true) {
    findings.push("policy.actualExecutionBlockingForbidden must be true");
  }
  if (policy.actualMergeBlockingForbidden !== true) {
    findings.push("policy.actualMergeBlockingForbidden must be true");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "governance release-readiness final gate ready_metadata")) {
    findings.push("checklist missing governance release-readiness final gate ready_metadata");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "h39 entry readiness ready_metadata")) {
    findings.push("checklist missing h39 entry readiness ready_metadata");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "governance release-readiness verification verified_metadata")) {
    findings.push("checklist missing governance release-readiness verification verified_metadata");
  }
  if (!gateChecklistHasLabel(checklist.checklist, "governance release-readiness alignment aligned_metadata")) {
    findings.push("checklist missing governance release-readiness alignment aligned_metadata");
  }
  if (!gateChecklistHas(checklist.checklist, "actual execution disabled", true)) {
    findings.push("checklist missing actual execution disabled");
  }
  if (!gateChecklistHas(checklist.checklist, "actual release enforcement disabled", true)) {
    findings.push("checklist missing actual release enforcement disabled");
  }
  if (!gateChecklistHas(checklist.checklist, "actual approval enforcement disabled", true)) {
    findings.push("checklist missing actual approval enforcement disabled");
  }
  if (!gateChecklistHas(checklist.checklist, "actual execution blocking disabled", true)) {
    findings.push("checklist missing actual execution blocking disabled");
  }
  if (!gateChecklistHas(checklist.checklist, "actual merge blocking disabled", true)) {
    findings.push("checklist missing actual merge blocking disabled");
  }
  if (!gateBlockersAligned(blockerReport.blockers, summary.gateBlockers)) {
    findings.push("blocker report and summary.gateBlockers misaligned");
  }
  if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.gateBlockers.length > 0)
  ) {
    findings.push("final_release_governance_gate_metadata_candidate requires no gate blockers");
  }
  if (!gateForbiddenIncludes(scope.forbiddenGateOperations, "actual execution")) {
    findings.push("scope.forbiddenGateOperations missing actual execution");
  }

  const verificationStatus = resolveFinalReleaseGovernanceGateVerificationStatus(findings);

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H39.5: final release governance gate verified_metadata — H40 entry 후보(enforcement 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H39.5: final release governance gate partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H39.5: final release governance gate failed — forbidden·blocker·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_final_release_governance_gate_verification_report",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
