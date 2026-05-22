/**
 * Stage 7-C contract bundle closure decision (read-only).
 */

import type {
  RuntimeContractBundleClosureDecision,
  RuntimeContractBundleClosureDecisionInput,
  RuntimeContractBundleClosureInput,
  ParsedRuntimeContractBundleClosureInput,
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
    !input.bundleItemsValid ||
    input.stage8EntryRequiresSeparateApproval !== true ||
    input.stage8EntryImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage8EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage7_runtime_contract_bundle_closed";
}
