/**
 * H40.5 — H41 진입 전 ultimate governance review **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
  ULTIMATE_GOVERNANCE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
} from "./runtimeUltimateGovernanceReviewConstants";
import {
  collectUltimateGovernanceReviewFinalSafetyBlockers,
  resolveUltimateGovernanceReviewFinalGateStatus,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type {
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewAlignmentReport,
  RuntimeUltimateGovernanceReviewFinalSafetyGate,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateGovernanceReviewVerificationReport,
  RuntimeUltimateGovernanceReviewViolationReport,
} from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeUltimateGovernanceReviewFinalSafetyGate(input: {
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly boundaryViolation: RuntimeUltimateGovernanceReviewViolationReport;
  readonly readinessVerification: RuntimeUltimateGovernanceReviewVerificationReport;
  readonly alignmentReport: RuntimeUltimateGovernanceReviewAlignmentReport;
}): RuntimeUltimateGovernanceReviewFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolveUltimateGovernanceReviewFinalGateStatus({
    summary,
    blockerReport,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectUltimateGovernanceReviewFinalSafetyBlockers({
    blockerReport,
    summary,
    boundaryViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `reviewStatus:${summary.reviewStatus}`,
    `reviewMode:${summary.reviewMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `proofViolations:${boundaryViolation.proofViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `reviewBlockers:${summary.reviewBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...ULTIMATE_GOVERNANCE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_ultimate_governance_review_final_safety_gate",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h41EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? ["H40.5: ultimate governance review final safety gate ready_metadata — H41 entry 후보(orchestration 없음)"]
        : []),
      ...(finalGateStatus === "watch"
        ? ["H40.5: ultimate governance review final safety gate watch — verification·alignment·wording risk 재검토"]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H40.5: ultimate governance review final safety gate blocked — violation·blocker·verification 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? ["H40.5: ultimate governance review final safety gate not_ready — ultimate_governance_metadata_ready 선행"]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...boundaryViolation.recommendations,
    ]),
  };
}
