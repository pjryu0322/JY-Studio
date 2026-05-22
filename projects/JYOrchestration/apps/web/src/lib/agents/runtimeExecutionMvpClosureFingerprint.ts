/**
 * Stage 9-B runtime MVP closure fingerprint and summary (read-only).
 */

import type { RuntimeExecutionMvpClosureDecision } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function buildRuntimeExecutionMvpClosureFingerprint(input: {
  readonly sourceStage9Decision: string;
  readonly sourceStage9AClosureReady: boolean;
  readonly itemCount: number;
  readonly stage10CandidateItemCount: number;
  readonly requiredBeforeStage10ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-execution-mvp-closure-v1",
    input.sourceStage9Decision,
    `stage9AClosureReady:${input.sourceStage9AClosureReady}`,
    `items:${input.itemCount}`,
    `stage10Candidates:${input.stage10CandidateItemCount}`,
    `requiredBeforeStage10:${input.requiredBeforeStage10ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeExecutionMvpClosureSummary(decision: RuntimeExecutionMvpClosureDecision): string {
  if (decision === "blocked") {
    return "Stage 9-B runtime MVP closure bundle is blocked.";
  }
  if (decision === "defer") {
    return "Stage 9-B closure defers; Stage 9-A API MVP or confirmations are incomplete.";
  }
  return "Stage 9 runtime API MVP is closed for Stage 10 external execution adapter design entry.";
}
