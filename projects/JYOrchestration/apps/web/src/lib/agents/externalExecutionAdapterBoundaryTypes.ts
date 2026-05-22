/**
 * Stage 10-A integrated external execution adapter boundary design types (read-only).
 */

import type { RuntimeExecutionMvpClosureInput } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export type ExternalExecutionAdapterBoundaryDecision =
  | "stage10_external_execution_adapter_boundary_ready"
  | "defer"
  | "blocked";

export type ExternalExecutionAdapterBoundaryStage =
  "stage_10_a_integrated_external_execution_adapter_boundary_design";

export type ExternalExecutionAdapterBoundaryMode =
  "read_only_external_execution_adapter_boundary_design";

export type ExternalExecutionAdapterBoundaryArea =
  | "external_adapter_contract"
  | "cursor_github_boundary"
  | "connector_gateway_boundary"
  | "runner_process_boundary"
  | "operator_approval_boundary"
  | "dry_run_simulation_boundary"
  | "rollback_boundary"
  | "audit_boundary"
  | "stage11_entry"
  | "separated_work";

export interface ExternalExecutionAdapterBoundaryInput {
  readonly runtimeMvpClosure?: RuntimeExecutionMvpClosureInput;

  readonly externalAdapterBoundaryReviewed?: boolean;
  readonly cursorGithubBoundaryReviewed?: boolean;
  readonly connectorBoundaryReviewed?: boolean;
  readonly runnerBoundaryReviewed?: boolean;
  readonly approvalBoundaryReviewed?: boolean;
  readonly dryRunSimulationBoundaryReviewed?: boolean;
  readonly rollbackBoundaryReviewed?: boolean;
  readonly auditBoundaryReviewed?: boolean;
  readonly stage11EntryReviewed?: boolean;
}

export interface ExternalExecutionAdapterBoundaryItem {
  readonly itemId: string;
  readonly area: ExternalExecutionAdapterBoundaryArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage9_b_runtime_mvp_closure";
  readonly designOnly: true;
  readonly implementedInThisStep: false;
  readonly externalExecutionAllowedInThisStep: false;
  readonly cursorExecutionAllowedInThisStep: false;
  readonly githubWriteAllowedInThisStep: false;
  readonly connectorGatewayCallAllowedInThisStep: false;
  readonly dbPersistenceAllowedInThisStep: false;
  readonly productionRunnerAllowedInThisStep: false;
  readonly stage11Candidate: boolean;
  readonly requiredBeforeStage11: boolean;
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
}

export interface ExternalExecutionAdapterBoundaryValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly implementedItemIds: readonly string[];
  readonly nonDesignOnlyItemIds: readonly string[];
  readonly externalExecutionAllowedItemIds: readonly string[];
  readonly cursorExecutionAllowedItemIds: readonly string[];
  readonly githubWriteAllowedItemIds: readonly string[];
  readonly connectorGatewayCallAllowedItemIds: readonly string[];
  readonly dbPersistenceAllowedItemIds: readonly string[];
  readonly productionRunnerAllowedItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly missingStage11CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage11ItemIds: readonly string[];
}

export interface ExternalExecutionAdapterBoundaryFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ExternalExecutionAdapterBoundaryChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ExternalExecutionAdapterBoundaryDecisionInput {
  readonly sourceStage9Decision: string;
  readonly sourceStage10EntryReady: boolean;
  readonly sourceStage10EntryMode: string;
  readonly sourceStage10AdapterBoundaryDesignAllowed: boolean;
  readonly sourceStage10CursorGithubBoundaryDesignAllowed: boolean;
  readonly sourceStage10ConnectorBoundaryDesignAllowed: boolean;
  readonly sourceStage10RunnerBoundaryDesignAllowed: boolean;
  readonly sourceStage10DryRunSimulationDesignAllowed: boolean;
  readonly sourceStage10RollbackBoundaryDesignAllowed: boolean;
  readonly sourceStage10ActualCursorExecutionAllowed: boolean;
  readonly sourceStage10ActualGithubWriteAllowed: boolean;
  readonly sourceStage10ActualConnectorGatewayCallAllowed: boolean;
  readonly sourceStage10ActualDbPersistenceAllowed: boolean;
  readonly sourceStage10ActualProductionRunnerAllowed: boolean;
  readonly sourceStage10ActualUiImplementationAllowed: boolean;
  readonly validationValid: boolean;
  readonly stage11EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage11RequiresSeparateApproval: boolean;
  readonly stage11ImplementationAllowedInThisStep: boolean;
}

export interface ExternalExecutionAdapterBoundaryReport {
  readonly mode: ExternalExecutionAdapterBoundaryMode;
  readonly stage: ExternalExecutionAdapterBoundaryStage;
  readonly decision: ExternalExecutionAdapterBoundaryDecision;

  readonly sourceStage9Decision: string;
  readonly sourceStage10EntryReady: boolean;
  readonly sourceStage10EntryMode: string;
  readonly sourceStage10ActualCursorExecutionAllowed: boolean;
  readonly sourceStage10ActualGithubWriteAllowed: boolean;
  readonly sourceStage10ActualConnectorGatewayCallAllowed: boolean;
  readonly sourceStage10ActualDbPersistenceAllowed: boolean;
  readonly sourceStage10ActualProductionRunnerAllowed: boolean;
  readonly sourceStage10ActualUiImplementationAllowed: boolean;

  readonly boundaryVersion: "external_execution_adapter_boundary_v1";
  readonly boundaryTitle: string;
  readonly boundarySummary: string;
  readonly boundaryFingerprint: string;

  readonly adapterBoundaryOnly: true;
  readonly stage11EntryCandidate: "external_execution_adapter_dry_run_package";
  readonly stage11EntryReady: boolean;
  readonly stage11EntryScope: readonly string[];
  readonly stage11EntryOutOfScope: readonly string[];
  readonly stage11RequiresSeparateApproval: true;
  readonly stage11ImplementationAllowedInThisStep: false;

  readonly actualExternalExecutionImplementedInThisStep: false;
  readonly actualCursorExecutionImplementedInThisStep: false;
  readonly actualGithubWriteImplementedInThisStep: false;
  readonly actualConnectorGatewayCallImplementedInThisStep: false;
  readonly actualDbPersistenceImplementedInThisStep: false;
  readonly actualProductionRunnerImplementedInThisStep: false;
  readonly actualUiImplementationImplementedInThisStep: false;

  readonly dryRunPackageDesignAllowed: true;
  readonly dryRunSimulationOnly: true;
  readonly externalAdapterContractCount: number;
  readonly stage11DryRunPackageRequiredBeforeActualExecution: true;

  readonly agentRegistryChangeManagementOutOfScope: true;
  readonly agentAddRemoveDeactivateOutOfScope: true;
  readonly agentRoleSlotImpactAnalysisRequired: true;
  readonly mandatoryGateAgentDeactivationRequiresApproval: true;
  readonly agentKnowledgeBindingChangeRequiresApproval: true;

  readonly boundaryItems: readonly ExternalExecutionAdapterBoundaryItem[];
  readonly validation: ExternalExecutionAdapterBoundaryValidationResult;
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly ExternalExecutionAdapterBoundaryChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionAdapterBoundaryChecklistItem[];
  readonly findings: readonly ExternalExecutionAdapterBoundaryFinding[];

  readonly itemCount: number;
  readonly stage11CandidateItemCount: number;
  readonly requiredBeforeStage11ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedExternalExecutionAdapterBoundaryInput = {
  readonly externalAdapterBoundaryReviewed: boolean;
  readonly cursorGithubBoundaryReviewed: boolean;
  readonly connectorBoundaryReviewed: boolean;
  readonly runnerBoundaryReviewed: boolean;
  readonly approvalBoundaryReviewed: boolean;
  readonly dryRunSimulationBoundaryReviewed: boolean;
  readonly rollbackBoundaryReviewed: boolean;
  readonly auditBoundaryReviewed: boolean;
  readonly stage11EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
