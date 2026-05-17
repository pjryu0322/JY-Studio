/**
 * H40.5 — ultimate governance review **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  assertRuntimeActualFlagsDisabled,
  assertRuntimeForbiddenFlagsTrue,
  prefixRuntimeInvariantViolations,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyInvariants";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
  ULTIMATE_GOVERNANCE_NO_ENFORCEMENT_MUST_BE_FALSE,
} from "./runtimeUltimateGovernanceReviewConstants";
import {
  collectUltimateGovernanceReviewWordingBlob,
  scanUltimateGovernanceReviewWordingRisks,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type {
  RuntimeOrchestrationForbiddenProof,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateGovernanceReviewViolationReport,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

export function detectRuntimeUltimateGovernanceReviewViolations(input: {
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
}): RuntimeUltimateGovernanceReviewViolationReport {
  const { summary, noEnforcementProof, forbiddenProof } = input;

  const actualFlagViolations = prefixRuntimeInvariantViolations(
    "runtimeUltimateGovernanceReviewSummary",
    assertRuntimeActualFlagsDisabled(summary as Record<string, unknown>)
  );

  const proofViolations: string[] = [];
  for (const { key, reportPrefix } of ULTIMATE_GOVERNANCE_NO_ENFORCEMENT_MUST_BE_FALSE) {
    if (noEnforcementProof[key] !== false) {
      proofViolations.push(`${reportPrefix}.${key} must be false`);
    }
  }
  if (noEnforcementProof.diagnosticOnly !== true) {
    proofViolations.push("runtimeUltimateNoEnforcementProof.diagnosticOnly must be true");
  }
  proofViolations.push(
    ...prefixRuntimeInvariantViolations(
      "runtimeOrchestrationForbiddenProof",
      assertRuntimeForbiddenFlagsTrue(forbiddenProof as Record<string, unknown>)
    )
  );

  const wordingRiskFindings = scanUltimateGovernanceReviewWordingRisks(
    collectUltimateGovernanceReviewWordingBlob([
      summary.rationaleKo,
      ...summary.reviewBlockers,
      ...summary.recommendations,
      ...noEnforcementProof.recommendations,
      ...forbiddenProof.recommendations,
    ])
  );

  return {
    mode: "runtime_ultimate_governance_review_violation_report",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    proofViolations: mergeSortedUniqueKo(proofViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 || proofViolations.length > 0 || wordingRiskFindings.length > 0
        ? ["H40.5: ultimate governance review violation — actual·proof·wording risk 제거(orchestration 없음)"]
        : []),
    ]),
  };
}
