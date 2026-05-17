/**
 * H45.5 — controlled pilot execution candidate **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  CONTROLLED_PILOT_EXECUTION_VERIFICATION_CHECKLIST_LABEL_ROWS,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import {
  candidateScopeSourceLayerValid,
  candidateScopeTargetLayerValid,
  contractIncludes,
  executionBlockersAligned,
  handoffBoundarySourceLayerValid,
  handoffBoundaryTargetLayerValid,
  resolveControlledPilotExecutionCandidateVerificationStatus,
  runtimeChecklistHasLabel,
} from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type {
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateScope,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateVerificationReport,
  RuntimeControlledPilotExecutionInputContract,
  RuntimeControlledPilotExecutionOutputContract,
  RuntimeControlledPilotExecutionReadinessChecklist,
  RuntimeFinalRuntimeHandoffBoundary,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function verifyRuntimeControlledPilotExecutionCandidateReadiness(input: {
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly handoff: RuntimeFinalRuntimeHandoffBoundary;
  readonly scope: RuntimeControlledPilotExecutionCandidateScope;
  readonly policy: RuntimeControlledPilotExecutionCandidatePolicy;
  readonly inputContract: RuntimeControlledPilotExecutionInputContract;
  readonly outputContract: RuntimeControlledPilotExecutionOutputContract;
  readonly checklist: RuntimeControlledPilotExecutionReadinessChecklist;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
}): RuntimeControlledPilotExecutionCandidateVerificationReport {
  const { summary, handoff, scope, policy, inputContract, outputContract, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    summary.executionMode !== "metadata_only"
  ) {
    findings.push("controlled_pilot_execution_metadata_candidate requires executionMode metadata_only");
  }
  if (summary.candidateStatus === "blocked" && summary.executionBlockers.length === 0) {
    findings.push("blocked candidateStatus requires executionBlockers");
  }
  if (!handoffBoundarySourceLayerValid(handoff.boundarySourceLayer)) {
    findings.push("handoff.boundarySourceLayer must be runtimePilotExecutionReadinessFinalSafetyGate");
  }
  if (!handoffBoundaryTargetLayerValid(handoff.boundaryTargetLayer)) {
    findings.push("handoff.boundaryTargetLayer must be finalRuntimeHandoffBoundary");
  }
  if (!candidateScopeSourceLayerValid(scope.candidateSourceLayer)) {
    findings.push("scope.candidateSourceLayer must be runtimePilotExecutionReadinessFinalSafetyGate");
  }
  if (!candidateScopeTargetLayerValid(scope.candidateTargetLayer)) {
    findings.push("scope.candidateTargetLayer must be controlledPilotExecutionCandidate");
  }
  if (handoff.forbiddenHandoffOperations.length === 0) {
    findings.push("handoff.forbiddenHandoffOperations must be non-empty");
  }
  if (scope.forbiddenCandidateOperations.length === 0) {
    findings.push("scope.forbiddenCandidateOperations must be non-empty");
  }
  if (policy.executionAllowedMode !== summary.executionMode) {
    findings.push("policy.executionAllowedMode misaligned with summary.executionMode");
  }
  if (policy.actualPilotActivationForbidden !== true) {
    findings.push("policy.actualPilotActivationForbidden must be true");
  }
  if (policy.actualPilotExecutionForbidden !== true) {
    findings.push("policy.actualPilotExecutionForbidden must be true");
  }
  if (policy.actualIsolatedRunnerInvocationForbidden !== true) {
    findings.push("policy.actualIsolatedRunnerInvocationForbidden must be true");
  }
  if (policy.actualIsolatedRunnerExecutionForbidden !== true) {
    findings.push("policy.actualIsolatedRunnerExecutionForbidden must be true");
  }
  if (policy.actualDryRunRunnerInvocationForbidden !== true) {
    findings.push("policy.actualDryRunRunnerInvocationForbidden must be true");
  }
  if (policy.actualDryRunRunnerExecutionForbidden !== true) {
    findings.push("policy.actualDryRunRunnerExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    findings.push("policy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.actualSandboxInvocationForbidden !== true) {
    findings.push("policy.actualSandboxInvocationForbidden must be true");
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
  if (!contractIncludes(inputContract.contractRows, "runtimePilotExecutionReadinessFinalSafetyGate")) {
    findings.push("input contract missing runtimePilotExecutionReadinessFinalSafetyGate");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimePilotExecutionReadinessVerificationReport")) {
    findings.push("input contract missing runtimePilotExecutionReadinessVerificationReport");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimePilotExecutionReadinessAlignmentReport")) {
    findings.push("input contract missing runtimePilotExecutionReadinessAlignmentReport");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimePilotExecutionReadinessViolationReport")) {
    findings.push("input contract missing runtimePilotExecutionReadinessViolationReport");
  }
  if (!contractIncludes(outputContract.contractRows, "finalRuntimeHandoffBoundaryMetadata")) {
    findings.push("output contract missing final runtime handoff boundary metadata");
  }
  if (!contractIncludes(outputContract.contractRows, "controlledPilotExecutionPolicyMetadata")) {
    findings.push("output contract missing controlled pilot execution policy metadata");
  }
  for (const label of CONTROLLED_PILOT_EXECUTION_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!executionBlockersAligned(blockerReport.blockers, summary.executionBlockers)) {
    findings.push("blocker report and summary.executionBlockers misaligned");
  }
  if (
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.executionBlockers.length > 0)
  ) {
    findings.push("controlled_pilot_execution_metadata_candidate requires no execution blockers");
  }

  const verificationStatus = resolveControlledPilotExecutionCandidateVerificationStatus(findings);

  return {
    mode: "runtime_controlled_pilot_execution_candidate_verification_report",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? [
            "H45.5: controlled pilot execution candidate verified_metadata — pilot validation entry 후보(pilot activation·execution 없음)",
          ]
        : []),
      ...(verificationStatus === "partial"
        ? ["H45.5: controlled pilot execution candidate partial — handoff·scope·policy·contract·checklist 정합성 재검토"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H45.5: controlled pilot execution candidate failed — policy·blocker·mode alignment 정렬"]
        : []),
    ]),
  };
}
