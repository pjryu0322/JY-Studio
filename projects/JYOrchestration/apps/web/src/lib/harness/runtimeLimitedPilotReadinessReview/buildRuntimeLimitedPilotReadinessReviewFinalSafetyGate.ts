/**
 * H43.5 — H44 진입 전 limited pilot readiness review **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  PILOT_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotReadinessReviewConstants";
import {
  collectPilotReadinessReviewFinalSafetyBlockers,
  resolvePilotReadinessReviewFinalGateStatus,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import type {
  RuntimeLimitedPilotReadinessReviewAlignmentReport,
  RuntimeLimitedPilotReadinessReviewFinalSafetyGate,
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimeLimitedPilotReadinessReviewVerificationReport,
  RuntimeLimitedPilotReadinessReviewViolationReport,
  RuntimePilotReadinessBlockerReport,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimeLimitedPilotReadinessReviewFinalSafetyGate(input: {
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly reviewViolation: RuntimeLimitedPilotReadinessReviewViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotReadinessReviewVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotReadinessReviewAlignmentReport;
}): RuntimeLimitedPilotReadinessReviewFinalSafetyGate {
  const { summary, blockerReport, reviewViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolvePilotReadinessReviewFinalGateStatus({
    summary,
    blockerReport,
    reviewViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectPilotReadinessReviewFinalSafetyBlockers({
    blockerReport,
    summary,
    reviewViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `reviewStatus:${summary.reviewStatus}`,
    `reviewMode:${summary.reviewMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${reviewViolation.actualFlagViolations.length}`,
    `proofViolations:${reviewViolation.proofViolations.length}`,
    `forbiddenProofViolations:${reviewViolation.forbiddenProofViolations.length}`,
    `wordingRiskFindings:${reviewViolation.wordingRiskFindings.length}`,
    `reviewBlockers:${summary.reviewBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...PILOT_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_limited_pilot_readiness_review_final_safety_gate",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h44EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? ["H43.5: pilot readiness final safety gate ready_metadata — H44 entry 후보(pilot activation 없음)"]
        : []),
      ...(finalGateStatus === "watch"
        ? ["H43.5: pilot readiness final safety gate watch — verification·alignment·wording risk 재검토"]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H43.5: pilot readiness final safety gate blocked — violation·blocker·proof 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? ["H43.5: pilot readiness final safety gate not_ready — limited_pilot_readiness_metadata_ready 선행"]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...reviewViolation.recommendations,
    ]),
  };
}
