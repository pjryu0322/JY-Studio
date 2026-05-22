/**
 * Stage 8-B runtime control bundle decision (read-only).
 */

import type {
  ParsedRuntimeControlBundleInput,
  RuntimeControlBundleDecision,
  RuntimeControlBundleDecisionInput,
  RuntimeControlBundleInput,
} from "@/lib/agents/runtimeControlBundleTypes";

export function parseRuntimeControlBundleInput(
  input?: RuntimeControlBundleInput,
): ParsedRuntimeControlBundleInput {
  const flags = [
    input?.runtimeControlBundleReviewed === true,
    input?.apiRouteDesignReviewed === true,
    input?.runnerAdapterDesignReviewed === true,
    input?.stateTransitionReviewed === true,
    input?.auditTrailReviewed === true,
    input?.stage9EntryReviewed === true,
  ];
  return {
    runtimeControlBundleReviewed: flags[0],
    apiRouteDesignReviewed: flags[1],
    runnerAdapterDesignReviewed: flags[2],
    stateTransitionReviewed: flags[3],
    auditTrailReviewed: flags[4],
    stage9EntryReviewed: flags[5],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeControlBundleDecision(
  input: RuntimeControlBundleDecisionInput,
): RuntimeControlBundleDecision {
  if (input.sourceStage8Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage8Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage8Decision !== "stage8_minimal_vertical_slice_ready") {
    return "defer";
  }

  if (
    input.sourceChainExecuted !== true ||
    input.sourceFinalStatus !== "mock_completed" ||
    input.sourceInMemoryOnly !== true ||
    input.sourceMockRunnerOnly !== true ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualApiRouteAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualCursorGithubCallAllowedInThisStep !== false ||
    input.sourceActualConnectorGatewayCallAllowedInThisStep !== false ||
    input.sourceActualDbWriteAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualUiAllowedInThisStep !== false ||
    !input.validationValid ||
    input.stage9RequiresSeparateApproval !== true ||
    input.stage9ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage9EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage8_runtime_control_bundle_ready";
}
