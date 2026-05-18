/**
 * H42.5 — limited pilot boundary **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import {
  collectLimitedPilotBoundaryWordingBlob,
  collectLimitedPilotPolicyForbiddenViolations,
  collectLimitedPilotSummaryActualFlagViolations,
  scanLimitedPilotBoundaryWordingRisks,
} from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryViolationReport,
} from "./runtimeLimitedPilotBoundaryTypes";

export function detectRuntimeLimitedPilotBoundaryViolations(input: {
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly policy: RuntimeLimitedPilotBoundaryPolicy;
}): RuntimeLimitedPilotBoundaryViolationReport {
  const { summary, policy } = input;

  const actualFlagViolations = mergeSortedUniqueKo(collectLimitedPilotSummaryActualFlagViolations(summary));
  const policyViolations = mergeSortedUniqueKo(collectLimitedPilotPolicyForbiddenViolations(policy));

  const wordingRiskFindings = scanLimitedPilotBoundaryWordingRisks(
    collectLimitedPilotBoundaryWordingBlob([
      summary.rationaleKo,
      ...summary.pilotBoundaryBlockers,
      ...summary.recommendations,
      ...policy.recommendations,
    ])
  );

  return {
    mode: "runtime_limited_pilot_boundary_violation_report",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations,
    policyViolations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 || policyViolations.length > 0 || wordingRiskFindings.length > 0
        ? ["H42.5: limited pilot boundary violation — actual·policy·wording risk 제거(pilot activation 없음)"]
        : []),
    ]),
  };
}
