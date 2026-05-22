/**
 * Stage 9-A runtime execution API MVP decision (read-only).
 */

import type {
  ParsedRuntimeExecutionApiMvpInput,
  RuntimeExecutionApiMvpDecision,
  RuntimeExecutionApiMvpDecisionInput,
  RuntimeExecutionApiMvpInput,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function parseRuntimeExecutionApiMvpInput(
  input?: RuntimeExecutionApiMvpInput,
): ParsedRuntimeExecutionApiMvpInput {
  const flags = [
    input?.operatorStage9ApprovalConfirmed === true,
    input?.apiRouteScopeConfirmed === true,
    input?.inMemoryStoreConfirmed === true,
    input?.mockRunnerAdapterConfirmed === true,
    input?.noDbPersistenceConfirmed === true,
    input?.noExternalExecutionConfirmed === true,
  ];
  return {
    operatorStage9ApprovalConfirmed: flags[0],
    apiRouteScopeConfirmed: flags[1],
    inMemoryStoreConfirmed: flags[2],
    mockRunnerAdapterConfirmed: flags[3],
    noDbPersistenceConfirmed: flags[4],
    noExternalExecutionConfirmed: flags[5],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionApiMvpDecision(
  input: RuntimeExecutionApiMvpDecisionInput,
): RuntimeExecutionApiMvpDecision {
  if (input.sourceDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceDecision === "defer") {
    return "defer";
  }

  if (input.sourceDecision !== "stage8_runtime_control_bundle_ready") {
    return "defer";
  }

  if (input.sourceStage9EntryReady !== true) {
    return "defer";
  }

  if (input.sourceStage9EntryMode !== "in_memory_runtime_execution_api_mvp") {
    return "blocked";
  }

  if (
    input.sourceStage9ActualExternalExecutionAllowed !== false ||
    input.sourceStage9DbPersistenceAllowed !== false ||
    input.sourceStage9UiImplementationAllowed !== false
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage9_runtime_execution_api_mvp_ready";
}
