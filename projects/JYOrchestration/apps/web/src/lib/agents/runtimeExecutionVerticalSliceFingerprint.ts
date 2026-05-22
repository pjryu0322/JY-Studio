/**
 * Stage 8-A runtime execution vertical slice fingerprint and summary (read-only).
 */

import type { RuntimeExecutionVerticalSliceDecision } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function buildRuntimeExecutionVerticalSliceFingerprint(input: {
  readonly sourceStage7Decision: string;
  readonly requestId: string;
  readonly finalStatus: string;
  readonly auditEventCount: number;
  readonly confirmationCount: number;
  readonly chainExecuted: boolean;
  readonly chainSkippedReason: string;
  readonly rawActualExecutionRequested: boolean;
  readonly actualExecutionRequestBlocked: boolean;
  readonly recordCount: number;
}): string {
  return [
    "runtime-execution-vertical-slice-v1",
    input.sourceStage7Decision,
    `requestId:${input.requestId}`,
    `finalStatus:${input.finalStatus}`,
    `auditEvents:${input.auditEventCount}`,
    `confirmations:${input.confirmationCount}`,
    `chainExecuted:${input.chainExecuted}`,
    `chainSkippedReason:${input.chainSkippedReason}`,
    `rawActualExecutionRequested:${input.rawActualExecutionRequested}`,
    `actualExecutionRequestBlocked:${input.actualExecutionRequestBlocked}`,
    `recordCount:${input.recordCount}`,
  ].join("::");
}

export function buildRuntimeExecutionVerticalSliceSummary(
  decision: RuntimeExecutionVerticalSliceDecision,
): string {
  if (decision === "blocked") {
    return "Stage 8-A minimal runtime execution vertical slice is blocked.";
  }
  if (decision === "defer") {
    return "Stage 8-A vertical slice defers; Stage 7-C closure or confirmations are incomplete.";
  }
  return "In-memory runtime execution vertical slice is ready. External API, runner, DB, and UI remain disallowed.";
}
