/**
 * H41.5 — controlled activation candidate **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS,
  CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_LABEL_ROWS,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import {
  activationBlockersAligned,
  candidateScopeSourceLayerValid,
  candidateScopeTargetLayerValid,
  handoffBoundarySourceLayerValid,
  handoffBoundaryTargetLayerValid,
  resolveControlledActivationCandidateVerificationStatus,
  runtimeChecklistHasLabel,
} from "./runtimeControlledActivationCandidateCheckHelpers";
import type {
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateScope,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateVerificationReport,
  RuntimeControlledActivationReadinessChecklist,
  RuntimeControlHandoffBoundary,
} from "./runtimeControlledActivationCandidateTypes";

export function verifyRuntimeControlledActivationCandidateReadiness(input: {
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly handoff: RuntimeControlHandoffBoundary;
  readonly scope: RuntimeControlledActivationCandidateScope;
  readonly policy: RuntimeControlledActivationCandidatePolicy;
  readonly checklist: RuntimeControlledActivationReadinessChecklist;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
}): RuntimeControlledActivationCandidateVerificationReport {
  const { summary, handoff, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    summary.activationMode !== "metadata_only"
  ) {
    findings.push("controlled_activation_metadata_candidate requires activationMode metadata_only");
  }
  if (summary.candidateStatus === "blocked" && summary.activationBlockers.length === 0) {
    findings.push("blocked candidateStatus requires activationBlockers");
  }
  if (!handoffBoundarySourceLayerValid(handoff.boundarySourceLayer)) {
    findings.push("handoff.boundarySourceLayer must be runtimeUltimateGovernanceReviewFinalSafetyGate");
  }
  if (!handoffBoundaryTargetLayerValid(handoff.boundaryTargetLayer)) {
    findings.push("handoff.boundaryTargetLayer must be runtimeControlHandoffBoundary");
  }
  if (!candidateScopeSourceLayerValid(scope.candidateSourceLayer)) {
    findings.push("scope.candidateSourceLayer must be runtimeUltimateGovernanceReviewFinalSafetyGate");
  }
  if (!candidateScopeTargetLayerValid(scope.candidateTargetLayer)) {
    findings.push("scope.candidateTargetLayer must be controlledActivationCandidate");
  }
  if (handoff.forbiddenHandoffOperations.length === 0) {
    findings.push("handoff.forbiddenHandoffOperations must be non-empty");
  }
  if (scope.forbiddenCandidateOperations.length === 0) {
    findings.push("scope.forbiddenCandidateOperations must be non-empty");
  }
  if (policy.activationAllowedMode !== summary.activationMode) {
    findings.push("policy.activationAllowedMode misaligned with summary.activationMode");
  }
  if (policy.actualRuntimeOrchestrationForbidden !== true) {
    findings.push("policy.actualRuntimeOrchestrationForbidden must be true");
  }
  if (policy.actualControlledActivationForbidden !== true) {
    findings.push("policy.actualControlledActivationForbidden must be true");
  }
  if (policy.actualPilotActivationForbidden !== true) {
    findings.push("policy.actualPilotActivationForbidden must be true");
  }
  if (policy.actualPilotExecutionForbidden !== true) {
    findings.push("policy.actualPilotExecutionForbidden must be true");
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
  for (const label of CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  for (const label of CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!activationBlockersAligned(blockerReport.blockers, summary.activationBlockers)) {
    findings.push("blocker report and summary.activationBlockers misaligned");
  }
  if (
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.activationBlockers.length > 0)
  ) {
    findings.push("controlled_activation_metadata_candidate requires no activation blockers");
  }

  const verificationStatus = resolveControlledActivationCandidateVerificationStatus(findings);

  return {
    mode: "runtime_controlled_activation_candidate_verification_report",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? ["H41.5: controlled activation candidate verified_metadata — H42 entry 후보(activation 없음)"]
        : []),
      ...(verificationStatus === "partial"
        ? ["H41.5: controlled activation candidate partial — handoff·scope·policy·checklist 정합성 재검토"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H41.5: controlled activation candidate failed — policy·blocker·mode alignment 정렬"]
        : []),
    ]),
  };
}
