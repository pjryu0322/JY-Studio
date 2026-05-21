/**
 * Shared Stage 6-A/6-B evaluator ready-path input (read-only chain).
 */

import type { RuntimeExecutionModelBaselineInput } from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import type { RuntimeExecutionModelCandidateInput } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import { buildStage5ReadyChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";

export function buildStage6AModelBaselineConfirmedInput(): Pick<
  RuntimeExecutionModelBaselineInput,
  | "stage6ModelReviewConfirmed"
  | "stage6NoActualExecutionConfirmed"
  | "stage6NoConnectorRoutingChangeConfirmed"
  | "stage6NoDbMigrationConfirmed"
  | "stage6NoFeatureFlagWireConfirmed"
> {
  return {
    stage6ModelReviewConfirmed: true,
    stage6NoActualExecutionConfirmed: true,
    stage6NoConnectorRoutingChangeConfirmed: true,
    stage6NoDbMigrationConfirmed: true,
    stage6NoFeatureFlagWireConfirmed: true,
  };
}

/** Ready-path input chaining Stage 5-F closure confirmations and Stage 6-A baseline confirmations. */
export function buildStage6AReadyBaselineInput(): RuntimeExecutionModelBaselineInput {
  return {
    stage5Closure: buildStage5ReadyChainInput(),
    ...buildStage6AModelBaselineConfirmedInput(),
  };
}

export function buildStage6BRuntimeExecutionModelCandidateConfirmedInput(): Pick<
  RuntimeExecutionModelCandidateInput,
  | "runtimeModelReviewConfirmed"
  | "runtimeModelNoExecutionWireConfirmed"
  | "runtimeModelNoPersistenceConfirmed"
> {
  return {
    runtimeModelReviewConfirmed: true,
    runtimeModelNoExecutionWireConfirmed: true,
    runtimeModelNoPersistenceConfirmed: true,
  };
}

/** Ready-path input for Stage 6-B (Stage 5-F + 6-A + 6-B confirmations). */
export function buildStage6BReadyCandidateInput(): RuntimeExecutionModelCandidateInput {
  return {
    baseline: buildStage6AReadyBaselineInput(),
    ...buildStage6BRuntimeExecutionModelCandidateConfirmedInput(),
  };
}
