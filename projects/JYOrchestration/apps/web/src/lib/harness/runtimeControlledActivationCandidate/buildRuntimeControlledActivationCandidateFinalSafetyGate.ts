/**
 * H41.5 — H42 진입 전 controlled activation candidate **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  CONTROLLED_ACTIVATION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import {
  collectControlledActivationCandidateFinalSafetyBlockers,
  resolveControlledActivationCandidateFinalGateStatus,
} from "./runtimeControlledActivationCandidateCheckHelpers";
import type {
  RuntimeControlledActivationCandidateAlignmentReport,
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidateFinalSafetyGate,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateVerificationReport,
  RuntimeControlledActivationCandidateViolationReport,
} from "./runtimeControlledActivationCandidateTypes";

export function buildRuntimeControlledActivationCandidateFinalSafetyGate(input: {
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledActivationCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledActivationCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledActivationCandidateAlignmentReport;
}): RuntimeControlledActivationCandidateFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolveControlledActivationCandidateFinalGateStatus({
    summary,
    blockerReport,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectControlledActivationCandidateFinalSafetyBlockers({
    blockerReport,
    summary,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `activationMode:${summary.activationMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `policyViolations:${boundaryViolation.policyViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `activationBlockers:${summary.activationBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...CONTROLLED_ACTIVATION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_controlled_activation_candidate_final_safety_gate",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h42EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? ["H41.5: controlled activation candidate final safety gate ready_metadata — H42 entry 후보(activation 없음)"]
        : []),
      ...(finalGateStatus === "watch"
        ? ["H41.5: controlled activation candidate final safety gate watch — verification·alignment·wording risk 재검토"]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H41.5: controlled activation candidate final safety gate blocked — violation·blocker·verification 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? ["H41.5: controlled activation candidate final safety gate not_ready — controlled_activation_metadata_candidate 선행"]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...boundaryViolation.recommendations,
    ]),
  };
}
