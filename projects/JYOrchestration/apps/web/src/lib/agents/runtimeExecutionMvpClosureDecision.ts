/**
 * Stage 9-B runtime MVP closure bundle decision (read-only).
 */

import type {
  ParsedRuntimeExecutionMvpClosureInput,
  RuntimeExecutionMvpClosureDecision,
  RuntimeExecutionMvpClosureDecisionInput,
  RuntimeExecutionMvpClosureInput,
} from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function parseRuntimeExecutionMvpClosureInput(
  input?: RuntimeExecutionMvpClosureInput,
): ParsedRuntimeExecutionMvpClosureInput {
  const flags = [
    input?.runtimeMvpClosureReviewed === true,
    input?.apiRouteReviewed === true,
    input?.storeLifecycleReviewed === true,
    input?.mockRunnerAdapterReviewed === true,
    input?.auditTrailReviewed === true,
    input?.stage10EntryReviewed === true,
  ];
  return {
    runtimeMvpClosureReviewed: flags[0],
    apiRouteReviewed: flags[1],
    storeLifecycleReviewed: flags[2],
    mockRunnerAdapterReviewed: flags[3],
    auditTrailReviewed: flags[4],
    stage10EntryReviewed: flags[5],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionMvpClosureDecision(
  input: RuntimeExecutionMvpClosureDecisionInput,
): RuntimeExecutionMvpClosureDecision {
  if (input.sourceStage9Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage9Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage9Decision !== "stage9_runtime_execution_api_mvp_ready") {
    return "defer";
  }

  if (input.sourceStage9AClosureReady !== true) {
    return "defer";
  }

  if (
    input.sourceRouteHandlerCount < 5 ||
    input.sourceServiceActionCount < 6 ||
    input.sourceBoundaryReportIncludedInEveryResponse !== true ||
    input.sourceApprovalActionImplemented !== true ||
    input.sourceMockRunnerAdapterImplemented !== true ||
    input.sourceAuditQueryImplemented !== true ||
    input.sourceStatusQueryImplemented !== true
  ) {
    return "blocked";
  }

  if (
    input.sourceActualApiRouteImplementedInThisStep !== true ||
    input.sourceInMemoryStoreImplementedInThisStep !== true ||
    input.sourceMockRunnerAdapterImplementedInThisStep !== true ||
    input.sourceActualExternalExecutionAllowedInThisStep !== false ||
    input.sourceActualCursorGithubCallAllowedInThisStep !== false ||
    input.sourceActualConnectorGatewayCallAllowedInThisStep !== false ||
    input.sourceActualDbWriteAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualUiImplementationAllowedInThisStep !== false ||
    !input.validationValid ||
    input.stage10RequiresSeparateApproval !== true ||
    input.stage10ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage10EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage9_runtime_api_mvp_closed";
}
