/**
 * H45.5 — controlled pilot execution candidate **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";
import {
  collectControlledPilotExecutionCandidateWordingBlob,
  collectControlledPilotExecutionPolicyForbiddenViolations,
  collectControlledPilotExecutionSummaryActualFlagViolations,
  scanControlledPilotExecutionCandidateWordingRisks,
} from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type {
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateViolationReport,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function detectRuntimeControlledPilotExecutionCandidateViolations(input: {
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly policy: RuntimeControlledPilotExecutionCandidatePolicy;
}): RuntimeControlledPilotExecutionCandidateViolationReport {
  const { summary, policy } = input;

  const actualFlagViolations = mergeSortedUniqueKo(collectControlledPilotExecutionSummaryActualFlagViolations(summary));
  const policyViolations = mergeSortedUniqueKo(collectControlledPilotExecutionPolicyForbiddenViolations(policy));

  const wordingRiskFindings = scanControlledPilotExecutionCandidateWordingRisks(
    collectControlledPilotExecutionCandidateWordingBlob([
      summary.rationaleKo,
      ...summary.executionBlockers,
      ...summary.recommendations,
      ...policy.recommendations,
    ])
  );

  return {
    mode: "runtime_controlled_pilot_execution_candidate_violation_report",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations,
    policyViolations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 || policyViolations.length > 0 || wordingRiskFindings.length > 0
        ? [
            "H45.5: controlled pilot execution candidate violation — actual·policy·wording risk 제거(pilot activation·execution 없음)",
          ]
        : []),
    ]),
  };
}
