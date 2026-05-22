/**
 * Stage 11-A external execution dry-run package decision (read-only).
 */

import type {
  ExternalExecutionDryRunPackageDecision,
  ExternalExecutionDryRunPackageDecisionInput,
  ExternalExecutionDryRunPackageInput,
  ParsedExternalExecutionDryRunPackageInput,
} from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function parseExternalExecutionDryRunPackageInput(
  input?: ExternalExecutionDryRunPackageInput,
): ParsedExternalExecutionDryRunPackageInput {
  const flags = [
    input?.adapterDryRunReviewed === true,
    input?.cursorGithubDryRunReviewed === true,
    input?.connectorDryRunReviewed === true,
    input?.runnerDryRunReviewed === true,
    input?.approvalBeforeDryRunReviewed === true,
    input?.rollbackBeforeDryRunReviewed === true,
    input?.auditBeforeDryRunReviewed === true,
    input?.noSideEffectBoundaryReviewed === true,
    input?.agentRegistryChangeBoundaryReviewed === true,
    input?.stage12EntryReviewed === true,
  ];
  return {
    adapterDryRunReviewed: flags[0],
    cursorGithubDryRunReviewed: flags[1],
    connectorDryRunReviewed: flags[2],
    runnerDryRunReviewed: flags[3],
    approvalBeforeDryRunReviewed: flags[4],
    rollbackBeforeDryRunReviewed: flags[5],
    auditBeforeDryRunReviewed: flags[6],
    noSideEffectBoundaryReviewed: flags[7],
    agentRegistryChangeBoundaryReviewed: flags[8],
    stage12EntryReviewed: flags[9],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveExternalExecutionDryRunPackageDecision(
  input: ExternalExecutionDryRunPackageDecisionInput,
): ExternalExecutionDryRunPackageDecision {
  if (input.sourceStage10Decision === "blocked") {
    return "blocked";
  }

  if (input.sourceStage10Decision === "defer") {
    return "defer";
  }

  if (input.sourceStage10Decision !== "stage10_external_execution_adapter_boundary_ready") {
    return "defer";
  }

  if (input.sourceStage11EntryReady !== true) {
    return "defer";
  }

  if (
    input.sourceDryRunPackageDesignAllowed !== true ||
    input.sourceDryRunSimulationOnly !== true ||
    input.sourceStage11DryRunPackageRequiredBeforeActualExecution !== true ||
    input.sourceActualExternalExecutionImplementedInThisStep !== false ||
    input.sourceActualCursorExecutionImplementedInThisStep !== false ||
    input.sourceActualGithubWriteImplementedInThisStep !== false ||
    input.sourceActualConnectorGatewayCallImplementedInThisStep !== false ||
    input.sourceActualDbPersistenceImplementedInThisStep !== false ||
    input.sourceActualProductionRunnerImplementedInThisStep !== false ||
    input.sourceActualUiImplementationImplementedInThisStep !== false ||
    input.sourceAgentRegistryChangeManagementOutOfScope !== true ||
    input.sourceAgentAddRemoveDeactivateOutOfScope !== true ||
    input.sourceAgentRoleSlotImpactAnalysisRequired !== true ||
    input.sourceMandatoryGateAgentDeactivationRequiresApproval !== true ||
    input.sourceAgentKnowledgeBindingChangeRequiresApproval !== true ||
    !input.validationValid ||
    input.stage12RequiresSeparateApproval !== true ||
    input.stage12ImplementationAllowedInThisStep !== false
  ) {
    return "blocked";
  }

  if (!input.stage12EntryReady || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage11_external_execution_dry_run_package_ready";
}
