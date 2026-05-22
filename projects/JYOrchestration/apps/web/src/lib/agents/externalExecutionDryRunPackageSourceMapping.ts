/**
 * Stage 11-A decision input mapping from Stage 10-A boundary source (read-only).
 */

import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageDecisionInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export const STAGE12_ENTRY_CANDIDATE = "external_execution_adapter_manual_dry_run_gate" as const;

export function mapExternalExecutionDryRunPackageDecisionInputFromSource(
  source: ExternalExecutionAdapterBoundaryReport,
  input: {
    readonly validationValid: boolean;
    readonly stage12EntryReady: boolean;
    readonly confirmationsSatisfied: boolean;
  },
): ExternalExecutionDryRunPackageDecisionInput {
  return {
    sourceStage10Decision: source.decision,
    sourceStage11EntryReady: source.stage11EntryReady,
    sourceDryRunPackageDesignAllowed: source.dryRunPackageDesignAllowed,
    sourceDryRunSimulationOnly: source.dryRunSimulationOnly,
    sourceStage11DryRunPackageRequiredBeforeActualExecution: source.stage11DryRunPackageRequiredBeforeActualExecution,
    sourceActualExternalExecutionImplementedInThisStep: source.actualExternalExecutionImplementedInThisStep,
    sourceActualCursorExecutionImplementedInThisStep: source.actualCursorExecutionImplementedInThisStep,
    sourceActualGithubWriteImplementedInThisStep: source.actualGithubWriteImplementedInThisStep,
    sourceActualConnectorGatewayCallImplementedInThisStep: source.actualConnectorGatewayCallImplementedInThisStep,
    sourceActualDbPersistenceImplementedInThisStep: source.actualDbPersistenceImplementedInThisStep,
    sourceActualProductionRunnerImplementedInThisStep: source.actualProductionRunnerImplementedInThisStep,
    sourceActualUiImplementationImplementedInThisStep: source.actualUiImplementationImplementedInThisStep,
    sourceAgentRegistryChangeManagementOutOfScope: source.agentRegistryChangeManagementOutOfScope,
    sourceAgentAddRemoveDeactivateOutOfScope: source.agentAddRemoveDeactivateOutOfScope,
    sourceAgentRoleSlotImpactAnalysisRequired: source.agentRoleSlotImpactAnalysisRequired,
    sourceMandatoryGateAgentDeactivationRequiresApproval: source.mandatoryGateAgentDeactivationRequiresApproval,
    sourceAgentKnowledgeBindingChangeRequiresApproval: source.agentKnowledgeBindingChangeRequiresApproval,
    validationValid: input.validationValid,
    stage12EntryReady: input.stage12EntryReady,
    confirmationsSatisfied: input.confirmationsSatisfied,
    stage12RequiresSeparateApproval: true,
    stage12ImplementationAllowedInThisStep: false,
  };
}

export function buildExternalExecutionDryRunPackageStage12ReportFields(input: {
  readonly stage12EntryReady: boolean;
}) {
  return {
    dryRunOnly: true as const,
    stage12EntryCandidate: STAGE12_ENTRY_CANDIDATE,
    stage12EntryReady: input.stage12EntryReady,
    stage12RequiresSeparateApproval: true as const,
    stage12ImplementationAllowedInThisStep: false as const,
    actualExternalExecutionImplementedInThisStep: false as const,
    actualCursorExecutionImplementedInThisStep: false as const,
    actualGithubWriteImplementedInThisStep: false as const,
    actualConnectorGatewayCallImplementedInThisStep: false as const,
    actualDbPersistenceImplementedInThisStep: false as const,
    actualProductionRunnerImplementedInThisStep: false as const,
    actualUiImplementationImplementedInThisStep: false as const,
    agentRegistryMutationImplementedInThisStep: false as const,
  };
}
