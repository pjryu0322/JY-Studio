/**
 * H41.5 — controlled activation candidate **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledActivationCandidateConstants";
import {
  collectControlledActivationCandidateWordingBlob,
  collectControlledActivationPolicyForbiddenViolations,
  collectControlledActivationSummaryActualFlagViolations,
  scanControlledActivationCandidateWordingRisks,
} from "./runtimeControlledActivationCandidateCheckHelpers";
import type {
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateViolationReport,
} from "./runtimeControlledActivationCandidateTypes";

export function detectRuntimeControlledActivationCandidateViolations(input: {
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly policy: RuntimeControlledActivationCandidatePolicy;
}): RuntimeControlledActivationCandidateViolationReport {
  const { summary, policy } = input;

  const actualFlagViolations = mergeSortedUniqueKo(collectControlledActivationSummaryActualFlagViolations(summary));
  const policyViolations = mergeSortedUniqueKo(collectControlledActivationPolicyForbiddenViolations(policy));

  const wordingRiskFindings = scanControlledActivationCandidateWordingRisks(
    collectControlledActivationCandidateWordingBlob([
      summary.rationaleKo,
      ...summary.activationBlockers,
      ...summary.recommendations,
      ...policy.recommendations,
    ])
  );

  return {
    mode: "runtime_controlled_activation_candidate_violation_report",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations,
    policyViolations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 || policyViolations.length > 0 || wordingRiskFindings.length > 0
        ? ["H41.5: controlled activation candidate violation — actual·policy·wording risk 제거(activation 없음)"]
        : []),
    ]),
  };
}
