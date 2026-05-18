/**
 * H39.5 — H40 진입 전 final release governance gate **ultimate no-enforcement final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  FINAL_RELEASE_GOVERNANCE_GATE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeFinalReleaseGovernanceGateConstants";
import {
  collectFinalReleaseGovernanceGateFinalSafetyBlockers,
  resolveFinalReleaseGovernanceGateFinalGateStatus,
} from "./runtimeFinalReleaseGovernanceGateCheckHelpers";
import type {
  RuntimeFinalReleaseGovernanceGateAlignmentReport,
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGateFinalSafetyGate,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateVerificationReport,
  RuntimeFinalReleaseGovernanceGateViolationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate(input: {
  readonly summary: RuntimeFinalReleaseGovernanceGateSummary;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
  readonly boundaryViolation: RuntimeFinalReleaseGovernanceGateViolationReport;
  readonly readinessVerification: RuntimeFinalReleaseGovernanceGateVerificationReport;
  readonly alignmentReport: RuntimeFinalReleaseGovernanceGateAlignmentReport;
}): RuntimeFinalReleaseGovernanceGateFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolveFinalReleaseGovernanceGateFinalGateStatus({
    summary,
    blockerReport,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectFinalReleaseGovernanceGateFinalSafetyBlockers({
    blockerReport,
    summary,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `gateMode:${summary.gateMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `gateBlockers:${summary.gateBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...FINAL_RELEASE_GOVERNANCE_GATE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H39.5: final release governance gate final safety gate ready_metadata — H40 entry 후보(enforcement 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H39.5: final release governance gate final safety gate watch — verification·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H39.5: final release governance gate final safety gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready"
      ? ["H39.5: final release governance gate final safety gate not_ready — final_release_governance_gate_metadata_candidate 선행"]
      : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_final_release_governance_gate_final_safety_gate",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h40EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
