/**
 * H43.5 — limited pilot readiness review **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import {
  collectPilotForbiddenProofViolations,
  collectPilotNoExecutionProofViolations,
  collectPilotReadinessReviewWordingBlob,
  collectPilotReadinessSummaryActualFlagViolations,
  scanPilotReadinessReviewWordingRisks,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import type {
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimeLimitedPilotReadinessReviewViolationReport,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function detectRuntimeLimitedPilotReadinessReviewViolations(input: {
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
}): RuntimeLimitedPilotReadinessReviewViolationReport {
  const { summary, noExecutionProof, forbiddenProof } = input;

  const actualFlagViolations = mergeSortedUniqueKo(collectPilotReadinessSummaryActualFlagViolations(summary));
  const proofViolations = mergeSortedUniqueKo(collectPilotNoExecutionProofViolations(noExecutionProof));
  const forbiddenProofViolations = mergeSortedUniqueKo(collectPilotForbiddenProofViolations(forbiddenProof));

  const wordingRiskFindings = scanPilotReadinessReviewWordingRisks(
    collectPilotReadinessReviewWordingBlob([
      summary.rationaleKo,
      ...summary.reviewBlockers,
      ...summary.recommendations,
      ...noExecutionProof.proofRows,
      ...forbiddenProof.proofRows,
    ])
  );

  return {
    mode: "runtime_limited_pilot_readiness_review_violation_report",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations,
    proofViolations,
    forbiddenProofViolations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 ||
      proofViolations.length > 0 ||
      forbiddenProofViolations.length > 0 ||
      wordingRiskFindings.length > 0
        ? ["H43.5: pilot readiness review violation — actual·proof·forbidden·wording risk 제거(pilot activation 없음)"]
        : []),
    ]),
  };
}
