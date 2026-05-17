/**
 * H39.5 — final release governance gate **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  FINAL_RELEASE_GATE_POLICY_FORBIDDEN_MUST_BE_TRUE,
  FINAL_RELEASE_GATE_SUMMARY_ACTUAL_MUST_BE_FALSE,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeFinalReleaseGovernanceGateConstants";
import {
  collectFinalReleaseGovernanceGateWordingBlob,
  scanFinalReleaseGovernanceGateWordingRisks,
} from "./runtimeFinalReleaseGovernanceGateCheckHelpers";
import type {
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateViolationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function detectRuntimeFinalReleaseGovernanceGateViolations(input: {
  readonly summary: RuntimeFinalReleaseGovernanceGateSummary;
  readonly policy: RuntimeFinalReleaseGovernanceGatePolicy;
}): RuntimeFinalReleaseGovernanceGateViolationReport {
  const { summary, policy } = input;
  const actualFlagViolations: string[] = [];

  for (const { key, reportPrefix } of FINAL_RELEASE_GATE_SUMMARY_ACTUAL_MUST_BE_FALSE) {
    if (summary[key] !== false) {
      actualFlagViolations.push(`${reportPrefix}.${key} must be false`);
    }
  }
  for (const { key, reportPrefix } of FINAL_RELEASE_GATE_POLICY_FORBIDDEN_MUST_BE_TRUE) {
    if (policy[key] !== true) {
      actualFlagViolations.push(`${reportPrefix}.${key} must be true`);
    }
  }

  const wordingRiskFindings = scanFinalReleaseGovernanceGateWordingRisks(
    collectFinalReleaseGovernanceGateWordingBlob([
      summary.rationaleKo,
      ...summary.gateBlockers,
      ...summary.recommendations,
      ...policy.recommendations,
    ])
  );

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H39.5: final release governance gate violation — actual·forbidden·blocking 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_final_release_governance_gate_violation_report",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
