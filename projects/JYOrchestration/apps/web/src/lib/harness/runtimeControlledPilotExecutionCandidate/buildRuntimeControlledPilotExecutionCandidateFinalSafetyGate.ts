/**
 * H45.5 — pilot validation 진입 전 controlled pilot execution candidate **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  CONTROLLED_PILOT_EXECUTION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import {
  collectControlledPilotExecutionCandidateFinalSafetyBlockers,
  resolveControlledPilotExecutionCandidateFinalGateStatus,
} from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type {
  RuntimeControlledPilotExecutionCandidateAlignmentReport,
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidateFinalSafetyGate,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateVerificationReport,
  RuntimeControlledPilotExecutionCandidateViolationReport,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function buildRuntimeControlledPilotExecutionCandidateFinalSafetyGate(input: {
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledPilotExecutionCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledPilotExecutionCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledPilotExecutionCandidateAlignmentReport;
}): RuntimeControlledPilotExecutionCandidateFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolveControlledPilotExecutionCandidateFinalGateStatus({
    summary,
    blockerReport,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectControlledPilotExecutionCandidateFinalSafetyBlockers({
    blockerReport,
    summary,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `executionMode:${summary.executionMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `policyViolations:${boundaryViolation.policyViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `executionBlockers:${summary.executionBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...CONTROLLED_PILOT_EXECUTION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_controlled_pilot_execution_candidate_final_safety_gate",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    pilotValidationEntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? [
            "H45.5: controlled pilot execution candidate final safety gate ready_metadata — pilot validation entry 후보(pilot activation·execution 없음)",
          ]
        : []),
      ...(finalGateStatus === "watch"
        ? [
            "H45.5: controlled pilot execution candidate final safety gate watch — verification·alignment·wording risk 재검토",
          ]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H45.5: controlled pilot execution candidate final safety gate blocked — violation·blocker·verification 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? [
            "H45.5: controlled pilot execution candidate final safety gate not_ready — controlled_pilot_execution_metadata_candidate 선행",
          ]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...boundaryViolation.recommendations,
    ]),
  };
}
