/**
 * Stage 10-A decision input mapping from Stage 9-B closure source (read-only).
 */

import type { ExternalExecutionAdapterBoundaryDecisionInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function mapExternalExecutionAdapterBoundaryDecisionInputFromSource(
  source: RuntimeExecutionMvpClosureReport,
  input: {
    readonly validationValid: boolean;
    readonly stage11EntryReady: boolean;
    readonly confirmationsSatisfied: boolean;
  },
): ExternalExecutionAdapterBoundaryDecisionInput {
  return {
    sourceStage9Decision: source.decision,
    sourceStage10EntryReady: source.stage10EntryReady,
    sourceStage10EntryMode: source.stage10EntryMode,
    sourceStage10AdapterBoundaryDesignAllowed: source.stage10AdapterBoundaryDesignAllowed,
    sourceStage10CursorGithubBoundaryDesignAllowed: source.stage10CursorGithubBoundaryDesignAllowed,
    sourceStage10ConnectorBoundaryDesignAllowed: source.stage10ConnectorBoundaryDesignAllowed,
    sourceStage10RunnerBoundaryDesignAllowed: source.stage10RunnerBoundaryDesignAllowed,
    sourceStage10DryRunSimulationDesignAllowed: source.stage10DryRunSimulationDesignAllowed,
    sourceStage10RollbackBoundaryDesignAllowed: source.stage10RollbackBoundaryDesignAllowed,
    sourceStage10ActualCursorExecutionAllowed: source.stage10ActualCursorExecutionAllowed,
    sourceStage10ActualGithubWriteAllowed: source.stage10ActualGithubWriteAllowed,
    sourceStage10ActualConnectorGatewayCallAllowed: source.stage10ActualConnectorGatewayCallAllowed,
    sourceStage10ActualDbPersistenceAllowed: source.stage10ActualDbPersistenceAllowed,
    sourceStage10ActualProductionRunnerAllowed: source.stage10ActualProductionRunnerAllowed,
    sourceStage10ActualUiImplementationAllowed: source.stage10ActualUiImplementationAllowed,
    validationValid: input.validationValid,
    stage11EntryReady: input.stage11EntryReady,
    confirmationsSatisfied: input.confirmationsSatisfied,
    stage11RequiresSeparateApproval: true,
    stage11ImplementationAllowedInThisStep: false,
  };
}

export const STAGE11_ENTRY_CANDIDATE = "external_execution_adapter_dry_run_package" as const;

export function buildExternalExecutionAdapterBoundaryStage11ReportFields(input: {
  readonly stage11EntryReady: boolean;
}) {
  return {
    adapterBoundaryOnly: true as const,
    stage11EntryCandidate: STAGE11_ENTRY_CANDIDATE,
    stage11EntryReady: input.stage11EntryReady,
    stage11RequiresSeparateApproval: true as const,
    stage11ImplementationAllowedInThisStep: false as const,
    actualExternalExecutionImplementedInThisStep: false as const,
    actualCursorExecutionImplementedInThisStep: false as const,
    actualGithubWriteImplementedInThisStep: false as const,
    actualConnectorGatewayCallImplementedInThisStep: false as const,
    actualDbPersistenceImplementedInThisStep: false as const,
    actualProductionRunnerImplementedInThisStep: false as const,
    actualUiImplementationImplementedInThisStep: false as const,
  };
}
