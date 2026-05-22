/**
 * Stage 8-B runtime control bundle support (read-only).
 */

import { evaluateRuntimeExecutionVerticalSlice } from "@/lib/agents/evaluateRuntimeExecutionVerticalSlice";
import type { RuntimeExecutionVerticalSliceReport } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import type {
  ParsedRuntimeControlBundleInput,
  RuntimeControlBundleChecklistItem,
  RuntimeControlBundleDecision,
  RuntimeControlBundleDecisionInput,
  RuntimeControlBundleInput,
} from "@/lib/agents/runtimeControlBundleTypes";

export { buildRuntimeControlBundleItems } from "@/lib/agents/runtimeControlBundleItems";
export { validateRuntimeControlBundleItems, computeStage9EntryReady } from "@/lib/agents/runtimeControlBundleValidation";

export {
  REQUIRED_STAGE8_B_CONFIRMATIONS,
  RUNTIME_CONTROL_BUNDLE_TITLE,
  RUNTIME_CONTROL_BUNDLE_VERSION,
  STAGE8_B_RECOMMENDED_NEXT_PHASES,
  STAGE8_B_SEPARATED_WORK_ITEMS,
  STAGE9_ENTRY_SCOPE,
  STAGE9_ENTRY_OUT_OF_SCOPE,
} from "@/lib/agents/runtimeControlBundleConstants";

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

export function buildRuntimeControlBundleFingerprint(input: {
  readonly sourceStage8Decision: string;
  readonly sourceFinalStatus: string;
  readonly itemCount: number;
  readonly stage9CandidateItemCount: number;
  readonly requiredBeforeStage9ItemCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-control-bundle-v1",
    input.sourceStage8Decision,
    input.sourceFinalStatus,
    `items:${input.itemCount}`,
    `stage9Candidates:${input.stage9CandidateItemCount}`,
    `requiredBeforeStage9:${input.requiredBeforeStage9ItemCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeControlBundleSummary(decision: RuntimeControlBundleDecision): string {
  if (decision === "blocked") {
    return "Stage 8-B runtime control bundle is blocked.";
  }
  if (decision === "defer") {
    return "Stage 8-B control bundle defers; Stage 8-A vertical slice or confirmations are incomplete.";
  }
  return "Stage 8 runtime control bundle is ready for Stage 9 entry planning. Actual API, runner, DB, and UI remain disallowed.";
}

export function buildRuntimeControlBundleChecklists(input: {
  readonly sourceStage8Decision: string;
  readonly sourceChainExecuted: boolean;
  readonly validationValid: boolean;
  readonly stage9EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly RuntimeControlBundleChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeControlBundleChecklistItem[];
} {
  const checklist: RuntimeControlBundleChecklistItem[] = [
    {
      item: "stage8_vertical_slice_ready",
      satisfied: input.sourceStage8Decision === "stage8_minimal_vertical_slice_ready",
      reason: "sourceStage8Decision",
    },
    {
      item: "stage8_chain_executed",
      satisfied: input.sourceChainExecuted,
      reason: "sourceChainExecuted",
    },
    {
      item: "control_items_valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "stage9_entry_ready",
      satisfied: input.stage9EntryReady,
      reason: "stage9EntryReady",
    },
    {
      item: "confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: RuntimeControlBundleChecklistItem[] = [
    {
      item: "actualApiRouteImplementedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
    {
      item: "actualRunnerImplementedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
    {
      item: "stage9ImplementationAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
  ];

  return { checklist, boundaryChecklist };
}

export function evaluateRuntimeControlBundleSource(
  input?: RuntimeControlBundleInput,
): RuntimeExecutionVerticalSliceReport {
  return evaluateRuntimeExecutionVerticalSlice(input?.verticalSlice);
}
