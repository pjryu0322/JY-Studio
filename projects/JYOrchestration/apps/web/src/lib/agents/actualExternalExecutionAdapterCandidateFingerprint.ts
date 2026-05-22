/**
 * Stage 13-A adapter candidate fingerprint and summary (read-only).
 */

import type { ActualExternalExecutionAdapterCandidateDecision } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

export function buildActualExternalExecutionAdapterCandidateFingerprint(input: {
  readonly sourceStage12Decision: string;
  readonly sourceStage13EntryReady: boolean;
  readonly itemCount: number;
  readonly stage14CandidateItemCount: number;
  readonly requiredBeforeStage14ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "actual-external-execution-adapter-candidate-v1",
    input.sourceStage12Decision,
    `sourceStage13EntryReady:${input.sourceStage13EntryReady}`,
    `items:${input.itemCount}`,
    `stage14Candidates:${input.stage14CandidateItemCount}`,
    `requiredBeforeStage14:${input.requiredBeforeStage14ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildActualExternalExecutionAdapterCandidateSummary(
  decision: ActualExternalExecutionAdapterCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 13-A actual external execution adapter candidate boundary is blocked.";
  }
  if (decision === "defer") {
    return "Stage 13-A adapter candidate boundary defers; Stage 12-A manual gate or confirmations are incomplete.";
  }
  return "Stage 13 actual external execution adapter candidate boundary is ready for Stage 14 operator-approved execution entry.";
}
