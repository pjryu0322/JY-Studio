/**
 * Stage 7-C contract bundle closure fingerprint and summary (read-only).
 */

import type { RuntimeContractBundleClosureDecision } from "@/lib/agents/runtimeContractBundleClosureTypes";

export function buildRuntimeContractBundleClosureFingerprint(input: {
  readonly sourceApiContractFingerprint: string;
  readonly bundleItemCount: number;
  readonly stage8CandidateItemCount: number;
  readonly requiredBeforeStage8ItemCount: number;
  readonly stage8EntryReady: boolean;
  readonly stage8EntryRequiresSeparateApproval: boolean;
  readonly stage8EntryImplementationAllowedInThisStep: boolean;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-contract-bundle-closure-v1",
    input.sourceApiContractFingerprint,
    `bundleItems:${input.bundleItemCount}`,
    `stage8Candidates:${input.stage8CandidateItemCount}`,
    `requiredBeforeStage8:${input.requiredBeforeStage8ItemCount}`,
    `stage8Ready:${input.stage8EntryReady}`,
    `separateApproval:${input.stage8EntryRequiresSeparateApproval}`,
    `implementationAllowed:${input.stage8EntryImplementationAllowedInThisStep}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeContractBundleClosureSummary(
  decision: RuntimeContractBundleClosureDecision,
): string {
  if (decision === "blocked") {
    return "Stage 7-C runtime contract bundle closure is blocked.";
  }
  if (decision === "defer") {
    return "Stage 7-C contract bundle closure defers; API contract or confirmations are incomplete.";
  }
  return "Stage 7 read-only contract bundle is closed. Stage 8-A minimal vertical slice entry is ready for separate approval.";
}
