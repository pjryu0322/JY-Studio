/**
 * Stage 10-A external execution adapter boundary decision (read-only).
 */

import type {
  ExternalExecutionAdapterBoundaryDecision,
  ExternalExecutionAdapterBoundaryDecisionInput,
  ExternalExecutionAdapterBoundaryInput,
  ParsedExternalExecutionAdapterBoundaryInput,
} from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export function parseExternalExecutionAdapterBoundaryInput(
  input?: ExternalExecutionAdapterBoundaryInput,
): ParsedExternalExecutionAdapterBoundaryInput {
  const flags = [
    input?.externalAdapterBoundaryReviewed === true,
    input?.cursorGithubBoundaryReviewed === true,
    input?.connectorBoundaryReviewed === true,
    input?.runnerBoundaryReviewed === true,
    input?.approvalBoundaryReviewed === true,
    input?.dryRunSimulationBoundaryReviewed === true,
    input?.rollbackBoundaryReviewed === true,
    input?.auditBoundaryReviewed === true,
    input?.stage11EntryReviewed === true,
  ];
  return {
    externalAdapterBoundaryReviewed: flags[0],
    cursorGithubBoundaryReviewed: flags[1],
    connectorBoundaryReviewed: flags[2],
    runnerBoundaryReviewed: flags[3],
    approvalBoundaryReviewed: flags[4],
    dryRunSimulationBoundaryReviewed: flags[5],
    rollbackBoundaryReviewed: flags[6],
    auditBoundaryReviewed: flags[7],
    stage11EntryReviewed: flags[8],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveExternalExecutionAdapterBoundaryDecision(
  input: ExternalExecutionAdapterBoundaryDecisionInput,
): ExternalExecutionAdapterBoundaryDecision {
  if (input.sourceStage9Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage9Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage9Decision !== "stage9_runtime_api_mvp_closed") {
    return "defer";
  }

  if (input.sourceStage10EntryReady !== true) {
    return "defer";
  }

  if (input.sourceStage10EntryMode !== "external_execution_adapter_boundary_design") {
    return "blocked";
  }

  if (
    input.sourceStage10AdapterBoundaryDesignAllowed !== true ||
    input.sourceStage10CursorGithubBoundaryDesignAllowed !== true ||
    input.sourceStage10ConnectorBoundaryDesignAllowed !== true ||
    input.sourceStage10RunnerBoundaryDesignAllowed !== true ||
    input.sourceStage10DryRunSimulationDesignAllowed !== true ||
    input.sourceStage10RollbackBoundaryDesignAllowed !== true ||
    input.sourceStage10ActualCursorExecutionAllowed !== false ||
    input.sourceStage10ActualGithubWriteAllowed !== false ||
    input.sourceStage10ActualConnectorGatewayCallAllowed !== false ||
    input.sourceStage10ActualDbPersistenceAllowed !== false ||
    input.sourceStage10ActualProductionRunnerAllowed !== false ||
    input.sourceStage10ActualUiImplementationAllowed !== false ||
    !input.validationValid ||
    input.stage11RequiresSeparateApproval !== true ||
    input.stage11ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage11EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage10_external_execution_adapter_boundary_ready";
}
