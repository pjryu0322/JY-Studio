/**
 * Stage 7-C runtime contract bundle closure support (read-only).
 */

import { evaluateRuntimeApiContractDesign } from "@/lib/agents/evaluateRuntimeApiContractDesign";
import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import { buildRuntimeContractBundleClosureChecklists } from "@/lib/agents/runtimeContractBundleClosureChecklists";
import { appendRuntimeContractBundleClosureFindings } from "@/lib/agents/runtimeContractBundleClosureFindings";
import {
  buildRuntimeContractBundleItems,
  computeStage8EntryReady,
  validateRuntimeContractBundleItems,
} from "@/lib/agents/runtimeContractBundleClosureItems";

export {
  buildRuntimeContractBundleItems,
  validateRuntimeContractBundleItems,
  computeStage8EntryReady,
} from "@/lib/agents/runtimeContractBundleClosureItems";

export { buildRuntimeContractBundleClosureChecklists } from "@/lib/agents/runtimeContractBundleClosureChecklists";
export { appendRuntimeContractBundleClosureFindings } from "@/lib/agents/runtimeContractBundleClosureFindings";

export {
  REQUIRED_STAGE7_C_BUNDLE_CLOSURE_CONFIRMATIONS,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_TITLE,
  RUNTIME_CONTRACT_BUNDLE_CLOSURE_VERSION,
  STAGE7_C_RECOMMENDED_NEXT_PHASES,
  STAGE7_C_SEPARATED_WORK_ITEMS,
  STAGE8_ENTRY_CANDIDATE,
} from "@/lib/agents/runtimeContractBundleClosureConstants";

import type {
  ParsedRuntimeContractBundleClosureInput,
  RuntimeContractBundleClosureDecision,
  RuntimeContractBundleClosureDecisionInput,
  RuntimeContractBundleClosureInput,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

export function parseRuntimeContractBundleClosureInput(
  input?: RuntimeContractBundleClosureInput,
): ParsedRuntimeContractBundleClosureInput {
  const flags = [
    input?.runtimeContractBundleReviewed === true,
    input?.runtimeContractBundleNoImplementationConfirmed === true,
    input?.runtimeContractBundleStage8EntryReviewed === true,
    input?.runtimeContractBundleSeparatedWorkConfirmed === true,
    input?.runtimeContractBundleRollbackReviewed === true,
  ];
  return {
    runtimeContractBundleReviewed: flags[0],
    runtimeContractBundleNoImplementationConfirmed: flags[1],
    runtimeContractBundleStage8EntryReviewed: flags[2],
    runtimeContractBundleSeparatedWorkConfirmed: flags[3],
    runtimeContractBundleRollbackReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeContractBundleClosureDecision(
  input: RuntimeContractBundleClosureDecisionInput,
): RuntimeContractBundleClosureDecision {
  if (input.sourceApiContractDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceApiContractDecision === "defer") {
    return "defer";
  }

  if (input.sourceApiContractDecision !== "ready_for_execution_runner_contract_design") {
    return "defer";
  }

  if (
    input.sourceEndpointContractCount < 6 ||
    input.sourceEndpointDesignOnlyCount !== input.sourceEndpointContractCount ||
    input.sourceImplementedEndpointCount !== 0 ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    input.sourceActualUiImplementationAllowedInThisStep !== false ||
    !input.bundleItemsValid
  ) {
    return "blocked";
  }

  if (!input.stage8EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage7_runtime_contract_bundle_closed";
}

export function buildRuntimeContractBundleClosureFingerprint(input: {
  readonly sourceApiContractFingerprint: string;
  readonly bundleItemCount: number;
  readonly stage8CandidateItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-contract-bundle-closure-v1",
    input.sourceApiContractFingerprint,
    `bundleItems:${input.bundleItemCount}`,
    `stage8Candidates:${input.stage8CandidateItemCount}`,
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

export function evaluateRuntimeContractBundleClosureSource(
  input?: RuntimeContractBundleClosureInput,
): RuntimeApiContractDesignReport {
  return evaluateRuntimeApiContractDesign(input?.apiContractDesign);
}
