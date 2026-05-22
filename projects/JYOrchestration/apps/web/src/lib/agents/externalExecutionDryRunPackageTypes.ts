/**
 * Stage 11-A external execution adapter dry-run package types (read-only).
 */

import type { ExternalExecutionAdapterBoundaryInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export type ExternalExecutionDryRunPackageDecision =
  | "stage11_external_execution_dry_run_package_ready"
  | "defer"
  | "blocked";

export type ExternalExecutionDryRunPackageStage = "stage_11_a_external_execution_adapter_dry_run_package";

export type ExternalExecutionDryRunPackageMode = "read_only_external_execution_dry_run_package";

export type ExternalExecutionDryRunPackageArea =
  | "adapter_dry_run_contract"
  | "cursor_github_dry_run_contract"
  | "connector_gateway_dry_run_contract"
  | "runner_process_dry_run_contract"
  | "operator_approval"
  | "rollback_plan"
  | "audit_event"
  | "no_side_effect_boundary"
  | "agent_registry_change_boundary"
  | "stage12_entry"
  | "separated_work";

export interface ExternalExecutionDryRunPackageInput {
  readonly adapterBoundary?: ExternalExecutionAdapterBoundaryInput;

  readonly adapterDryRunReviewed?: boolean;
  readonly cursorGithubDryRunReviewed?: boolean;
  readonly connectorDryRunReviewed?: boolean;
  readonly runnerDryRunReviewed?: boolean;
  readonly approvalBeforeDryRunReviewed?: boolean;
  readonly rollbackBeforeDryRunReviewed?: boolean;
  readonly auditBeforeDryRunReviewed?: boolean;
  readonly noSideEffectBoundaryReviewed?: boolean;
  readonly agentRegistryChangeBoundaryReviewed?: boolean;
  readonly stage12EntryReviewed?: boolean;
}

export interface ExternalExecutionDryRunPackageItem {
  readonly itemId: string;
  readonly area: ExternalExecutionDryRunPackageArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage10_a_external_execution_adapter_boundary";
  readonly dryRunOnly: true;
  readonly implementedInThisStep: false;
  readonly actualExternalExecutionAllowedInThisStep: false;
  readonly actualCursorExecutionAllowedInThisStep: false;
  readonly actualGithubWriteAllowedInThisStep: false;
  readonly actualConnectorGatewayCallAllowedInThisStep: false;
  readonly actualDbPersistenceAllowedInThisStep: false;
  readonly actualProductionRunnerAllowedInThisStep: false;
  readonly actualUiImplementationAllowedInThisStep: false;
  readonly agentRegistryMutationAllowedInThisStep: false;
  readonly stage12Candidate: boolean;
  readonly requiredBeforeStage12: boolean;
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
}

export interface ExternalExecutionDryRunPackageValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly implementedItemIds: readonly string[];
  readonly nonDryRunOnlyItemIds: readonly string[];
  readonly externalExecutionAllowedItemIds: readonly string[];
  readonly cursorExecutionAllowedItemIds: readonly string[];
  readonly githubWriteAllowedItemIds: readonly string[];
  readonly connectorGatewayCallAllowedItemIds: readonly string[];
  readonly dbPersistenceAllowedItemIds: readonly string[];
  readonly productionRunnerAllowedItemIds: readonly string[];
  readonly uiImplementationAllowedItemIds: readonly string[];
  readonly agentRegistryMutationAllowedItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly missingStage12CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage12ItemIds: readonly string[];
}

export interface ExternalExecutionDryRunPackageFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ExternalExecutionDryRunPackageChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ExternalExecutionDryRunPackageDecisionInput {
  readonly sourceStage10Decision: string;
  readonly sourceStage11EntryReady: boolean;
  readonly sourceDryRunPackageDesignAllowed: boolean;
  readonly sourceDryRunSimulationOnly: boolean;
  readonly sourceStage11DryRunPackageRequiredBeforeActualExecution: boolean;

  readonly sourceActualExternalExecutionImplementedInThisStep: boolean;
  readonly sourceActualCursorExecutionImplementedInThisStep: boolean;
  readonly sourceActualGithubWriteImplementedInThisStep: boolean;
  readonly sourceActualConnectorGatewayCallImplementedInThisStep: boolean;
  readonly sourceActualDbPersistenceImplementedInThisStep: boolean;
  readonly sourceActualProductionRunnerImplementedInThisStep: boolean;
  readonly sourceActualUiImplementationImplementedInThisStep: boolean;

  readonly sourceAgentRegistryChangeManagementOutOfScope: boolean;
  readonly sourceAgentAddRemoveDeactivateOutOfScope: boolean;
  readonly sourceAgentRoleSlotImpactAnalysisRequired: boolean;
  readonly sourceMandatoryGateAgentDeactivationRequiresApproval: boolean;
  readonly sourceAgentKnowledgeBindingChangeRequiresApproval: boolean;

  readonly validationValid: boolean;
  readonly stage12EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage12RequiresSeparateApproval: boolean;
  readonly stage12ImplementationAllowedInThisStep: boolean;
}

export interface ExternalExecutionDryRunPackageReport {
  readonly mode: ExternalExecutionDryRunPackageMode;
  readonly stage: ExternalExecutionDryRunPackageStage;
  readonly decision: ExternalExecutionDryRunPackageDecision;

  readonly sourceStage10Decision: string;
  readonly sourceStage11EntryReady: boolean;
  readonly sourceDryRunPackageDesignAllowed: boolean;
  readonly sourceDryRunSimulationOnly: boolean;
  readonly sourceStage11DryRunPackageRequiredBeforeActualExecution: boolean;

  readonly sourceAgentRegistryChangeManagementOutOfScope: boolean;
  readonly sourceAgentAddRemoveDeactivateOutOfScope: boolean;
  readonly sourceAgentRoleSlotImpactAnalysisRequired: boolean;
  readonly sourceMandatoryGateAgentDeactivationRequiresApproval: boolean;
  readonly sourceAgentKnowledgeBindingChangeRequiresApproval: boolean;

  readonly manualDryRunGateDesignAllowed: true;
  readonly operatorApprovedDryRunInvocationAllowed: true;
  readonly mockExternalAdapterResultPackageAllowed: true;
  readonly dryRunAuditEventPackageAllowed: true;
  readonly rollbackPlanReviewBeforeActualExecutionAllowed: true;
  readonly stage12ManualGateRequiredBeforeActualExecution: true;

  readonly actualManualExternalInvocationAllowedInThisStep: false;
  readonly actualAdapterSideEffectAllowedInThisStep: false;
  readonly actualAgentRegistryMutationAllowedInThisStep: false;

  readonly packageVersion: "external_execution_dry_run_package_v1";
  readonly packageTitle: string;
  readonly packageSummary: string;
  readonly packageFingerprint: string;

  readonly dryRunOnly: true;
  readonly stage12EntryCandidate: "external_execution_adapter_manual_dry_run_gate";
  readonly stage12EntryReady: boolean;
  readonly stage12EntryScope: readonly string[];
  readonly stage12EntryOutOfScope: readonly string[];
  readonly stage12RequiresSeparateApproval: true;
  readonly stage12ImplementationAllowedInThisStep: false;

  readonly actualExternalExecutionImplementedInThisStep: false;
  readonly actualCursorExecutionImplementedInThisStep: false;
  readonly actualGithubWriteImplementedInThisStep: false;
  readonly actualConnectorGatewayCallImplementedInThisStep: false;
  readonly actualDbPersistenceImplementedInThisStep: false;
  readonly actualProductionRunnerImplementedInThisStep: false;
  readonly actualUiImplementationImplementedInThisStep: false;
  readonly agentRegistryMutationImplementedInThisStep: false;

  readonly dryRunItems: readonly ExternalExecutionDryRunPackageItem[];
  readonly validation: ExternalExecutionDryRunPackageValidationResult;
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly ExternalExecutionDryRunPackageChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionDryRunPackageChecklistItem[];
  readonly findings: readonly ExternalExecutionDryRunPackageFinding[];

  readonly itemCount: number;
  readonly stage12CandidateItemCount: number;
  readonly requiredBeforeStage12ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedExternalExecutionDryRunPackageInput = {
  readonly adapterDryRunReviewed: boolean;
  readonly cursorGithubDryRunReviewed: boolean;
  readonly connectorDryRunReviewed: boolean;
  readonly runnerDryRunReviewed: boolean;
  readonly approvalBeforeDryRunReviewed: boolean;
  readonly rollbackBeforeDryRunReviewed: boolean;
  readonly auditBeforeDryRunReviewed: boolean;
  readonly noSideEffectBoundaryReviewed: boolean;
  readonly agentRegistryChangeBoundaryReviewed: boolean;
  readonly stage12EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
