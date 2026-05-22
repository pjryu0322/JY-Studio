/**
 * Stage 8-B runtime control bundle fingerprint and summary (read-only).
 */

import type { RuntimeControlBundleDecision } from "@/lib/agents/runtimeControlBundleTypes";

export function buildRuntimeControlBundleFingerprint(input: {
  readonly sourceStage8Decision: string;
  readonly sourceFinalStatus: string;
  readonly itemCount: number;
  readonly stage9CandidateItemCount: number;
  readonly requiredBeforeStage9ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-control-bundle-v1",
    input.sourceStage8Decision,
    input.sourceFinalStatus,
    `items:${input.itemCount}`,
    `stage9Candidates:${input.stage9CandidateItemCount}`,
    `requiredBeforeStage9:${input.requiredBeforeStage9ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeControlBundleSummary(decision: RuntimeControlBundleDecision): string {
  if (decision === "blocked") {
    return "Stage 8-B runtime control bundle is blocked.";
  }
  if (decision === "defer") {
    return "Stage 8-B control bundle defers; Stage 8-A vertical slice or confirmations are incomplete.";
  }
  return "Stage 8 runtime control bundle is ready for Stage 9 entry planning. Actual API, runner, DB, and UI remain disallowed.";
}
