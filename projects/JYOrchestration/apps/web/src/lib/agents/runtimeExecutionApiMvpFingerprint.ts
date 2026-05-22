/**
 * Stage 9-A runtime execution API MVP fingerprint and summary (read-only).
 */

import type { RuntimeExecutionApiMvpDecision } from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function buildRuntimeExecutionApiMvpFingerprint(input: {
  readonly sourceStage8Decision: string;
  readonly sourceStage9EntryMode: string;
  readonly confirmationCount: number;
  readonly endpointCount: number;
}): string {
  return [
    "runtime-execution-api-mvp-v1",
    input.sourceStage8Decision,
    input.sourceStage9EntryMode,
    `endpoints:${input.endpointCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeExecutionApiMvpSummary(decision: RuntimeExecutionApiMvpDecision): string {
  if (decision === "blocked") {
    return "Stage 9-A runtime execution API MVP is blocked.";
  }
  if (decision === "defer") {
    return "Stage 9-A API MVP defers; Stage 8-B control bundle or confirmations are incomplete.";
  }
  return "Stage 9 runtime execution API MVP is ready. Routes use in-memory store and mock runner only.";
}
