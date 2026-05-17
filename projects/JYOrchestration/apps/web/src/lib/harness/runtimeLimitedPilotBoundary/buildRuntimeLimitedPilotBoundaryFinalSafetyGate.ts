/**
 * H42.5 — H43 진입 전 limited pilot boundary **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  LIMITED_PILOT_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotBoundaryConstants";
import {
  collectLimitedPilotBoundaryFinalSafetyBlockers,
  resolveLimitedPilotBoundaryFinalGateStatus,
} from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryAlignmentReport,
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryFinalSafetyGate,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryVerificationReport,
  RuntimeLimitedPilotBoundaryViolationReport,
} from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotBoundaryFinalSafetyGate(input: {
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
  readonly boundaryViolation: RuntimeLimitedPilotBoundaryViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotBoundaryVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotBoundaryAlignmentReport;
}): RuntimeLimitedPilotBoundaryFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolveLimitedPilotBoundaryFinalGateStatus({
    summary,
    blockerReport,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectLimitedPilotBoundaryFinalSafetyBlockers({
    blockerReport,
    summary,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `pilotBoundaryMode:${summary.pilotBoundaryMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `policyViolations:${boundaryViolation.policyViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `pilotBoundaryBlockers:${summary.pilotBoundaryBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...LIMITED_PILOT_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_limited_pilot_boundary_final_safety_gate",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h43EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? ["H42.5: limited pilot boundary final safety gate ready_metadata — H43 entry 후보(pilot activation 없음)"]
        : []),
      ...(finalGateStatus === "watch"
        ? ["H42.5: limited pilot boundary final safety gate watch — verification·alignment·wording risk 재검토"]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H42.5: limited pilot boundary final safety gate blocked — violation·blocker·verification 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? ["H42.5: limited pilot boundary final safety gate not_ready — limited_pilot_boundary_metadata_candidate 선행"]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...boundaryViolation.recommendations,
    ]),
  };
}
