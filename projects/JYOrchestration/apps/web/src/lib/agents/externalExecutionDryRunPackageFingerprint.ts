/**
 * Stage 11-A dry-run package fingerprint and summary (read-only).
 */

import type { ExternalExecutionDryRunPackageDecision } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function buildExternalExecutionDryRunPackageFingerprint(input: {
  readonly sourceStage10Decision: string;
  readonly sourceStage11EntryReady: boolean;
  readonly itemCount: number;
  readonly stage12CandidateItemCount: number;
  readonly requiredBeforeStage12ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "external-execution-dry-run-package-v1",
    input.sourceStage10Decision,
    `sourceStage11EntryReady:${input.sourceStage11EntryReady}`,
    `items:${input.itemCount}`,
    `stage12Candidates:${input.stage12CandidateItemCount}`,
    `requiredBeforeStage12:${input.requiredBeforeStage12ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildExternalExecutionDryRunPackageSummary(
  decision: ExternalExecutionDryRunPackageDecision,
): string {
  if (decision === "blocked") {
    return "Stage 11-A external execution dry-run package is blocked.";
  }
  if (decision === "defer") {
    return "Stage 11-A dry-run package defers; Stage 10-A boundary or confirmations are incomplete.";
  }
  return "Stage 11 external execution dry-run package is ready for Stage 12 manual dry-run gate entry.";
}
