/**
 * Shared Stage 6-A/6-B/6-C evaluator ready-path input (read-only chain).
 */

import type { RuntimeExecutionModelBaselineInput } from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import type { RuntimeExecutionModelCandidateInput } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionContractCandidateInput } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type { RuntimeExecutionModelReviewGateInput } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
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

export function buildStage6CModelReviewGateConfirmedInput(): Required<
  Pick<
    RuntimeExecutionModelReviewGateInput,
    | "runtimeModelReviewGateConfirmed"
    | "runtimeModelFieldContractReviewed"
    | "runtimeModelNoRunBoundaryReviewed"
    | "runtimeModelPersistenceBoundaryReviewed"
    | "runtimeModelApprovalBoundaryReviewed"
  >
> {
  return {
    runtimeModelReviewGateConfirmed: true,
    runtimeModelFieldContractReviewed: true,
    runtimeModelNoRunBoundaryReviewed: true,
    runtimeModelPersistenceBoundaryReviewed: true,
    runtimeModelApprovalBoundaryReviewed: true,
  };
}

/** Ready-path input for Stage 6-C (Stage 6-B ready + 6-C review confirmations). */
export function buildStage6CReadyReviewGateInput(): RuntimeExecutionModelReviewGateInput {
  return {
    modelCandidate: buildStage6BReadyCandidateInput(),
    ...buildStage6CModelReviewGateConfirmedInput(),
  };
}

export function buildStage6DContractCandidateConfirmedInput(): Required<
  Pick<
    RuntimeExecutionContractCandidateInput,
    | "runtimeExecutionContractCandidateConfirmed"
    | "runtimeExecutionBoundaryContractReviewed"
    | "runtimeExecutionDryRunContractReviewed"
    | "runtimeExecutionRollbackContractReviewed"
    | "runtimeExecutionApprovalContractReviewed"
  >
> {
  return {
    runtimeExecutionContractCandidateConfirmed: true,
    runtimeExecutionBoundaryContractReviewed: true,
    runtimeExecutionDryRunContractReviewed: true,
    runtimeExecutionRollbackContractReviewed: true,
    runtimeExecutionApprovalContractReviewed: true,
  };
}

/** Ready-path input for Stage 6-D (Stage 6-C ready + 6-D contract confirmations). */
export function buildStage6DReadyContractCandidateInput(): RuntimeExecutionContractCandidateInput {
  return {
    reviewGate: buildStage6CReadyReviewGateInput(),
    ...buildStage6DContractCandidateConfirmedInput(),
  };
}
