/**
 * Stage 12-A manual dry-run gate fingerprint and summary (read-only).
 */

import type { ExternalExecutionManualDryRunGateDecision } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function buildExternalExecutionManualDryRunGateFingerprint(input: {
  readonly sourceStage11Decision: string;
  readonly sourceStage12EntryReady: boolean;
  readonly itemCount: number;
  readonly stage13CandidateItemCount: number;
  readonly requiredBeforeStage13ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "external-execution-manual-dry-run-gate-v1",
    input.sourceStage11Decision,
    `sourceStage12EntryReady:${input.sourceStage12EntryReady}`,
    `items:${input.itemCount}`,
    `stage13Candidates:${input.stage13CandidateItemCount}`,
    `requiredBeforeStage13:${input.requiredBeforeStage13ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildExternalExecutionManualDryRunGateSummary(
  decision: ExternalExecutionManualDryRunGateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 12-A external execution manual dry-run gate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 12-A manual dry-run gate defers; Stage 11-A dry-run package or confirmations are incomplete.";
  }
  return "Stage 12 external execution manual dry-run gate is ready for Stage 13 actual adapter candidate entry.";
}
