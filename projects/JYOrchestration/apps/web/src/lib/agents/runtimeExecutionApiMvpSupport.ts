/**
 * Stage 9-A runtime execution API MVP support (read-only).
 */

import { evaluateRuntimeControlBundle } from "@/lib/agents/evaluateRuntimeControlBundle";
import {
  parseRuntimeExecutionApiMvpInput,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/runtimeExecutionApiMvpDecision";
import { appendRuntimeExecutionApiMvpFindings } from "@/lib/agents/runtimeExecutionApiMvpFindings";
import type {
  RuntimeExecutionApiMvpChecklistItem,
  RuntimeExecutionApiMvpDecision,
  RuntimeExecutionApiMvpInput,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeControlBundleReport } from "@/lib/agents/runtimeControlBundleTypes";

export {
  REQUIRED_STAGE9_A_CONFIRMATIONS,
  RUNTIME_EXECUTION_API_MVP_TITLE,
  RUNTIME_EXECUTION_API_MVP_VERSION,
  STAGE9_A_ENDPOINT_CONTRACTS,
  STAGE9_A_RECOMMENDED_NEXT_PHASES,
  STAGE9_A_SEPARATED_WORK_ITEMS,
  STAGE9_A_SUPPORTED_ACTIONS,
} from "@/lib/agents/runtimeExecutionApiMvpConstants";

export {
  parseRuntimeExecutionApiMvpInput,
  resolveRuntimeExecutionApiMvpDecision,
} from "@/lib/agents/runtimeExecutionApiMvpDecision";

export { appendRuntimeExecutionApiMvpFindings } from "@/lib/agents/runtimeExecutionApiMvpFindings";

export function evaluateRuntimeExecutionApiMvpSource(
  input?: RuntimeExecutionApiMvpInput,
): RuntimeControlBundleReport {
  return evaluateRuntimeControlBundle(input?.runtimeControlBundle);
}

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

export function buildRuntimeExecutionApiMvpChecklists(input: {
  readonly sourceStage8Decision: string;
  readonly sourceStage9EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly RuntimeExecutionApiMvpChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionApiMvpChecklistItem[];
} {
  const checklist: RuntimeExecutionApiMvpChecklistItem[] = [
    {
      item: "stage8_control_bundle_ready",
      satisfied: input.sourceStage8Decision === "stage8_runtime_control_bundle_ready",
      reason: "sourceStage8Decision",
    },
    {
      item: "stage9_entry_ready",
      satisfied: input.sourceStage9EntryReady,
      reason: "sourceStage9EntryReady",
    },
    {
      item: "confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: RuntimeExecutionApiMvpChecklistItem[] = [
    {
      item: "actualExternalExecutionAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
    {
      item: "actualDbWriteAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
    {
      item: "actualUiImplementationAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
  ];

  return { checklist, boundaryChecklist };
}
