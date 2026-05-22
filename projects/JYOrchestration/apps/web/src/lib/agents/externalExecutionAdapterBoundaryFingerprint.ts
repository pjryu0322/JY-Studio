/**
 * Stage 10-A external execution adapter boundary fingerprint and summary (read-only).
 */

import type { ExternalExecutionAdapterBoundaryDecision } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export function buildExternalExecutionAdapterBoundaryFingerprint(input: {
  readonly sourceStage9Decision: string;
  readonly sourceStage10EntryReady: boolean;
  readonly itemCount: number;
  readonly stage11CandidateItemCount: number;
  readonly requiredBeforeStage11ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "external-execution-adapter-boundary-v1",
    input.sourceStage9Decision,
    `sourceStage10EntryReady:${input.sourceStage10EntryReady}`,
    `items:${input.itemCount}`,
    `stage11Candidates:${input.stage11CandidateItemCount}`,
    `requiredBeforeStage11:${input.requiredBeforeStage11ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildExternalExecutionAdapterBoundarySummary(
  decision: ExternalExecutionAdapterBoundaryDecision,
): string {
  if (decision === "blocked") {
    return "Stage 10-A external execution adapter boundary design is blocked.";
  }
  if (decision === "defer") {
    return "Stage 10-A adapter boundary defers; Stage 9-B closure or confirmations are incomplete.";
  }
  return "Stage 10 external execution adapter boundary is ready for Stage 11 dry-run package entry.";
}
