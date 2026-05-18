/**
 * H42.5 — limited pilot boundary **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  LIMITED_PILOT_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS,
  LIMITED_PILOT_VERIFICATION_CHECKLIST_LABEL_ROWS,
  RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotBoundaryConstants";
import {
  limitedPilotScopeSourceLayerValid,
  limitedPilotScopeTargetLayerValid,
  pilotBoundaryBlockersAligned,
  resolveLimitedPilotBoundaryVerificationStatus,
  runtimeChecklistHasLabel,
} from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundaryScope,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryVerificationReport,
  RuntimeLimitedPilotInputContract,
  RuntimeLimitedPilotOutputContract,
  RuntimeLimitedPilotReadinessChecklist,
} from "./runtimeLimitedPilotBoundaryTypes";

function contractIncludes(rows: readonly string[], fragment: string): boolean {
  return rows.some((r) => r.toLowerCase().includes(fragment.toLowerCase()));
}

export function verifyRuntimeLimitedPilotBoundaryReadiness(input: {
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly scope: RuntimeLimitedPilotBoundaryScope;
  readonly policy: RuntimeLimitedPilotBoundaryPolicy;
  readonly inputContract: RuntimeLimitedPilotInputContract;
  readonly outputContract: RuntimeLimitedPilotOutputContract;
  readonly checklist: RuntimeLimitedPilotReadinessChecklist;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
}): RuntimeLimitedPilotBoundaryVerificationReport {
  const { summary, scope, policy, inputContract, outputContract, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    summary.pilotBoundaryMode !== "metadata_only"
  ) {
    findings.push("limited_pilot_boundary_metadata_candidate requires pilotBoundaryMode metadata_only");
  }
  if (summary.candidateStatus === "blocked" && summary.pilotBoundaryBlockers.length === 0) {
    findings.push("blocked candidateStatus requires pilotBoundaryBlockers");
  }
  if (!limitedPilotScopeSourceLayerValid(scope.candidateSourceLayer)) {
    findings.push("scope.candidateSourceLayer must be runtimeControlledActivationCandidateFinalSafetyGate");
  }
  if (!limitedPilotScopeTargetLayerValid(scope.candidateTargetLayer)) {
    findings.push("scope.candidateTargetLayer must be limitedControlledRuntimePilotBoundaryCandidate");
  }
  if (scope.forbiddenPilotBoundaryOperations.length === 0) {
    findings.push("scope.forbiddenPilotBoundaryOperations must be non-empty");
  }
  if (policy.pilotBoundaryAllowedMode !== summary.pilotBoundaryMode) {
    findings.push("policy.pilotBoundaryAllowedMode misaligned with summary.pilotBoundaryMode");
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
  if (policy.actualIsolatedRunnerInvocationForbidden !== true) {
    findings.push("policy.actualIsolatedRunnerInvocationForbidden must be true");
  }
  if (policy.actualIsolatedRunnerExecutionForbidden !== true) {
    findings.push("policy.actualIsolatedRunnerExecutionForbidden must be true");
  }
  if (policy.actualDryRunRunnerInvocationForbidden !== true) {
    findings.push("policy.actualDryRunRunnerInvocationForbidden must be true");
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
  if (!contractIncludes(inputContract.contractRows, "runtimeControlledActivationCandidateFinalSafetyGate")) {
    findings.push("input contract missing runtimeControlledActivationCandidateFinalSafetyGate");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimeControlledActivationCandidateVerificationReport")) {
    findings.push("input contract missing runtimeControlledActivationCandidateVerificationReport");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimeControlledActivationCandidateAlignmentReport")) {
    findings.push("input contract missing runtimeControlledActivationCandidateAlignmentReport");
  }
  if (!contractIncludes(inputContract.contractRows, "runtimeControlledActivationCandidateViolationReport")) {
    findings.push("input contract missing runtimeControlledActivationCandidateViolationReport");
  }
  if (!contractIncludes(outputContract.contractRows, "pilotBoundaryReadinessMetadata")) {
    findings.push("output contract missing pilot boundary readiness metadata");
  }
  if (!contractIncludes(outputContract.contractRows, "pilotBoundaryPolicyMetadata")) {
    findings.push("output contract missing pilot boundary policy metadata");
  }
  for (const label of LIMITED_PILOT_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  for (const label of LIMITED_PILOT_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!pilotBoundaryBlockersAligned(blockerReport.blockers, summary.pilotBoundaryBlockers)) {
    findings.push("blocker report and summary.pilotBoundaryBlockers misaligned");
  }
  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.pilotBoundaryBlockers.length > 0)
  ) {
    findings.push("limited_pilot_boundary_metadata_candidate requires no pilot boundary blockers");
  }

  const verificationStatus = resolveLimitedPilotBoundaryVerificationStatus(findings);

  return {
    mode: "runtime_limited_pilot_boundary_verification_report",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? ["H42.5: limited pilot boundary verified_metadata — H43 entry 후보(pilot activation 없음)"]
        : []),
      ...(verificationStatus === "partial"
        ? ["H42.5: limited pilot boundary partial — scope·policy·contract·checklist 정합성 재검토"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H42.5: limited pilot boundary failed — policy·blocker·mode alignment 정렬"]
        : []),
    ]),
  };
}
