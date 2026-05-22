/**
 * Shared Stage 6-A/6-B/6-C evaluator ready-path input (read-only chain).
 */

import type { RuntimeExecutionModelBaselineInput } from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import type { RuntimeExecutionModelCandidateInput } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionContractCandidateInput } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type { RuntimeExecutionContractClosureInput } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import type { RuntimeApiContractDesignInput } from "@/lib/agents/runtimeApiContractDesignTypes";
import type { RuntimeContractBundleClosureInput } from "@/lib/agents/runtimeContractBundleClosureTypes";
import type { RuntimeControlBundleInput } from "@/lib/agents/runtimeControlBundleTypes";
import type { RuntimeExecutionApiMvpInput } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeExecutionVerticalSliceInput } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import { STAGE8_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import type { RuntimeImplementationPlanningCandidateInput } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import type { RuntimeExecutionDryRunContractInput } from "@/lib/agents/runtimeExecutionDryRunContractTypes";
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

export function buildStage6EDryRunContractConfirmedInput(): Required<
  Pick<
    RuntimeExecutionDryRunContractInput,
    | "runtimeExecutionDryRunContractConfirmed"
    | "runtimeExecutionDryRunBoundaryReviewed"
    | "runtimeExecutionDryRunNoRunnerConfirmed"
    | "runtimeExecutionDryRunPersistenceReviewed"
    | "runtimeExecutionDryRunRollbackReviewed"
  >
> {
  return {
    runtimeExecutionDryRunContractConfirmed: true,
    runtimeExecutionDryRunBoundaryReviewed: true,
    runtimeExecutionDryRunNoRunnerConfirmed: true,
    runtimeExecutionDryRunPersistenceReviewed: true,
    runtimeExecutionDryRunRollbackReviewed: true,
  };
}

/** Ready-path input for Stage 6-E (Stage 6-D ready + 6-E dry-run confirmations). */
export function buildStage6EReadyDryRunContractInput(): RuntimeExecutionDryRunContractInput {
  return {
    contractCandidate: buildStage6DReadyContractCandidateInput(),
    ...buildStage6EDryRunContractConfirmedInput(),
  };
}

export function buildStage6FRuntimeExecutionContractClosureConfirmedInput(): Required<
  Pick<
    RuntimeExecutionContractClosureInput,
    | "runtimeExecutionContractClosureConfirmed"
    | "runtimeExecutionNoActualRunnerConfirmed"
    | "runtimeExecutionNoPersistenceConfirmed"
    | "runtimeExecutionSeparatedWorkReviewed"
    | "runtimeExecutionStage7HandoffReviewed"
  >
> {
  return {
    runtimeExecutionContractClosureConfirmed: true,
    runtimeExecutionNoActualRunnerConfirmed: true,
    runtimeExecutionNoPersistenceConfirmed: true,
    runtimeExecutionSeparatedWorkReviewed: true,
    runtimeExecutionStage7HandoffReviewed: true,
  };
}

/** Ready-path input for Stage 6-F (Stage 6-E ready + 6-F closure confirmations). */
export function buildStage6FReadyContractClosureInput(): RuntimeExecutionContractClosureInput {
  return {
    dryRunContract: buildStage6EReadyDryRunContractInput(),
    ...buildStage6FRuntimeExecutionContractClosureConfirmedInput(),
  };
}

export function buildStage7AImplementationPlanningConfirmedInput(): Required<
  Pick<
    RuntimeImplementationPlanningCandidateInput,
    | "runtimeImplementationPlanningReviewed"
    | "runtimeImplementationSeparatePrConfirmed"
    | "runtimeImplementationNoActualExecutionConfirmed"
    | "runtimeImplementationRollbackPlanReviewed"
    | "runtimeImplementationOperatorApprovalRequiredConfirmed"
  >
> {
  return {
    runtimeImplementationPlanningReviewed: true,
    runtimeImplementationSeparatePrConfirmed: true,
    runtimeImplementationNoActualExecutionConfirmed: true,
    runtimeImplementationRollbackPlanReviewed: true,
    runtimeImplementationOperatorApprovalRequiredConfirmed: true,
  };
}

/** Ready-path input for Stage 7-A (Stage 6-F ready + 7-A planning confirmations). */
export function buildStage7AReadyImplementationPlanningInput(): RuntimeImplementationPlanningCandidateInput {
  return {
    contractClosure: buildStage6FReadyContractClosureInput(),
    ...buildStage7AImplementationPlanningConfirmedInput(),
  };
}

export function buildStage7BRuntimeApiContractConfirmedInput(): Required<
  Pick<
    RuntimeApiContractDesignInput,
    | "runtimeApiContractReviewed"
    | "runtimeApiNoEndpointImplementationConfirmed"
    | "runtimeApiNoPersistenceConfirmed"
    | "runtimeApiSecurityBoundaryReviewed"
    | "runtimeApiApprovalBoundaryReviewed"
  >
> {
  return {
    runtimeApiContractReviewed: true,
    runtimeApiNoEndpointImplementationConfirmed: true,
    runtimeApiNoPersistenceConfirmed: true,
    runtimeApiSecurityBoundaryReviewed: true,
    runtimeApiApprovalBoundaryReviewed: true,
  };
}

/** Ready-path input for Stage 7-B (Stage 7-A ready + 7-B API contract confirmations). */
export function buildStage7BReadyRuntimeApiContractInput(): RuntimeApiContractDesignInput {
  return {
    implementationPlanning: buildStage7AReadyImplementationPlanningInput(),
    ...buildStage7BRuntimeApiContractConfirmedInput(),
  };
}

export function buildStage7CContractBundleClosureConfirmedInput(): Required<
  Pick<
    RuntimeContractBundleClosureInput,
    | "runtimeContractBundleReviewed"
    | "runtimeContractBundleNoImplementationConfirmed"
    | "runtimeContractBundleStage8EntryReviewed"
    | "runtimeContractBundleSeparatedWorkConfirmed"
    | "runtimeContractBundleRollbackReviewed"
  >
> {
  return {
    runtimeContractBundleReviewed: true,
    runtimeContractBundleNoImplementationConfirmed: true,
    runtimeContractBundleStage8EntryReviewed: true,
    runtimeContractBundleSeparatedWorkConfirmed: true,
    runtimeContractBundleRollbackReviewed: true,
  };
}

/** Ready-path input for Stage 7-C (Stage 7-B ready + 7-C bundle closure confirmations). */
export function buildStage7CReadyContractBundleClosureInput(): RuntimeContractBundleClosureInput {
  return {
    apiContractDesign: buildStage7BReadyRuntimeApiContractInput(),
    ...buildStage7CContractBundleClosureConfirmedInput(),
  };
}

export function buildStage8AConfirmedVerticalSliceInput(): Required<
  Pick<
    RuntimeExecutionVerticalSliceInput,
    | "operatorStage8ApprovalConfirmed"
    | "scopeBoundaryConfirmed"
    | "mockRunnerOnlyConfirmed"
    | "inMemoryOnlyConfirmed"
    | "noExternalSideEffectConfirmed"
  >
> {
  return {
    operatorStage8ApprovalConfirmed: true,
    scopeBoundaryConfirmed: true,
    mockRunnerOnlyConfirmed: true,
    inMemoryOnlyConfirmed: true,
    noExternalSideEffectConfirmed: true,
  };
}

/** Ready-path input for Stage 8-A (Stage 7-C closed + in-memory mock vertical slice confirmations). */
export function buildStage8AReadyVerticalSliceInput(): RuntimeExecutionVerticalSliceInput {
  return {
    contractBundleClosure: buildStage7CReadyContractBundleClosureInput(),
    request: {
      requestId: "stage8a-request-001",
      projectId: "jy-orchestration",
      sourceStage: "stage_8_a",
      requestedBy: "operator",
      unitKind: "mock_runner",
      commandPreview: "mock-runtime-execution",
      payloadPreview: "in-memory vertical slice only",
      createdAtIso: STAGE8_A_DEFAULT_NOW_ISO,
      approvedForMockRun: true,
      actualExecutionRequested: false,
    },
    ...buildStage8AConfirmedVerticalSliceInput(),
  };
}

export function buildStage8BConfirmedRuntimeControlBundleInput(): Required<
  Pick<
    RuntimeControlBundleInput,
    | "runtimeControlBundleReviewed"
    | "apiRouteDesignReviewed"
    | "runnerAdapterDesignReviewed"
    | "stateTransitionReviewed"
    | "auditTrailReviewed"
    | "stage9EntryReviewed"
  >
> {
  return {
    runtimeControlBundleReviewed: true,
    apiRouteDesignReviewed: true,
    runnerAdapterDesignReviewed: true,
    stateTransitionReviewed: true,
    auditTrailReviewed: true,
    stage9EntryReviewed: true,
  };
}

/** Ready-path input for Stage 8-B (Stage 8-A ready + 8-B control bundle confirmations). */
export function buildStage8BReadyRuntimeControlBundleInput(): RuntimeControlBundleInput {
  return {
    verticalSlice: buildStage8AReadyVerticalSliceInput(),
    ...buildStage8BConfirmedRuntimeControlBundleInput(),
  };
}

export function buildStage9AConfirmedRuntimeExecutionApiMvpInput(): Required<
  Pick<
    RuntimeExecutionApiMvpInput,
    | "operatorStage9ApprovalConfirmed"
    | "apiRouteScopeConfirmed"
    | "inMemoryStoreConfirmed"
    | "mockRunnerAdapterConfirmed"
    | "noDbPersistenceConfirmed"
    | "noExternalExecutionConfirmed"
  >
> {
  return {
    operatorStage9ApprovalConfirmed: true,
    apiRouteScopeConfirmed: true,
    inMemoryStoreConfirmed: true,
    mockRunnerAdapterConfirmed: true,
    noDbPersistenceConfirmed: true,
    noExternalExecutionConfirmed: true,
  };
}

/** Ready-path input for Stage 9-A (Stage 8-B ready + 9-A API MVP confirmations). */
export function buildStage9AReadyRuntimeExecutionApiMvpInput(): RuntimeExecutionApiMvpInput {
  return {
    runtimeControlBundle: buildStage8BReadyRuntimeControlBundleInput(),
    ...buildStage9AConfirmedRuntimeExecutionApiMvpInput(),
  };
}
