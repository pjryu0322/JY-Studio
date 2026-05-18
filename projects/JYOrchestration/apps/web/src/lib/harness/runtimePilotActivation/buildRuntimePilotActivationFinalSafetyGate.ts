/**
 * H27.5 — H28 진입 전 activation **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimePilotActivationBlockerReport,
  RuntimePilotActivationBoundaryViolationReport,
  RuntimePilotActivationFinalGateStatus,
  RuntimePilotActivationFinalSafetyGate,
  RuntimePilotActivationReadinessVerificationReport,
  RuntimePilotActivationSummary,
} from "./runtimePilotActivationTypes";

export function buildRuntimePilotActivationFinalSafetyGate(input: {
  readonly summary: RuntimePilotActivationSummary;
  readonly blockerReport: RuntimePilotActivationBlockerReport;
  readonly boundaryViolation: RuntimePilotActivationBoundaryViolationReport;
  readonly readinessVerification: RuntimePilotActivationReadinessVerificationReport;
}): RuntimePilotActivationFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("activation readiness verification failed");
  }
  if (summary.activationBlockers.length > 0 && blockerReport.blockers.length === 0) {
    blockers.push(...summary.activationBlockers.slice(0, 2));
  }

  let finalGateStatus: RuntimePilotActivationFinalGateStatus;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    readinessVerification.verificationStatus === "failed" ||
    summary.candidateStatus === "blocked" ||
    blockerReport.blockers.length > 0
  ) {
    finalGateStatus = "blocked";
  } else if (
    summary.candidateStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    summary.candidateStatus === "activation_metadata_candidate" &&
    summary.activationMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `activationMode:${summary.activationMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `blockerReport:${blockerReport.blockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h28EntryReadiness:metadata_only_gate",
    "actualPilotActivationForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H27.5: final gate ready_metadata — H28 pilot skeleton metadata gate 후보(activation 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H27.5: final gate watch — readiness·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H27.5: final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H27.5: final gate not_ready — H27 candidate 선행"] : []),
    ...readinessVerification.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_pilot_activation_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    finalGateStatus,
    h28EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
