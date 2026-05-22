/**
 * Stage 12-A external execution manual dry-run gate types (read-only).
 */

import type { ExternalExecutionDryRunPackageInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export type ExternalExecutionManualDryRunGateDecision =
  | "stage12_external_execution_manual_dry_run_gate_ready"
  | "defer"
  | "blocked";

export type ExternalExecutionManualDryRunGateStage =
  "stage_12_a_external_execution_adapter_manual_dry_run_gate";

export type ExternalExecutionManualDryRunGateMode =
  "read_only_external_execution_manual_dry_run_gate";

export type ExternalExecutionManualDryRunGateArea =
  | "manual_dry_run_gate"
  | "operator_invocation_request"
  | "mock_external_adapter_result"
  | "dry_run_audit_event"
  | "rollback_review"
  | "no_side_effect_boundary"
  | "agent_registry_change_boundary"
  | "stage13_entry"
  | "separated_work";

export interface ExternalExecutionManualDryRunGateInput {
  readonly dryRunPackage?: ExternalExecutionDryRunPackageInput;

  readonly manualGateReviewed?: boolean;
  readonly operatorInvocationReviewed?: boolean;
  readonly mockAdapterResultReviewed?: boolean;
  readonly dryRunAuditReviewed?: boolean;
  readonly rollbackReviewCompleted?: boolean;
  readonly noSideEffectBoundaryReviewed?: boolean;
  readonly agentRegistryBoundaryReviewed?: boolean;
  readonly stage13EntryReviewed?: boolean;
}

export interface ExternalExecutionManualDryRunGateItem {
  readonly itemId: string;
  readonly area: ExternalExecutionManualDryRunGateArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage11_a_external_execution_dry_run_package";
  readonly manualGateOnly: true;
  readonly implementedInThisStep: false;
  readonly actualExternalInvocationAllowedInThisStep: false;
  readonly actualAdapterSideEffectAllowedInThisStep: false;
  readonly actualCursorExecutionAllowedInThisStep: false;
  readonly actualGithubWriteAllowedInThisStep: false;
  readonly actualConnectorGatewayCallAllowedInThisStep: false;
  readonly actualDbPersistenceAllowedInThisStep: false;
  readonly actualProductionRunnerAllowedInThisStep: false;
  readonly actualUiImplementationAllowedInThisStep: false;
  readonly agentRegistryMutationAllowedInThisStep: false;
  readonly stage13Candidate: boolean;
  readonly requiredBeforeStage13: boolean;
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
}

export interface ExternalExecutionManualDryRunGateValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly implementedItemIds: readonly string[];
  readonly nonManualGateOnlyItemIds: readonly string[];
  readonly externalInvocationAllowedItemIds: readonly string[];
  readonly adapterSideEffectAllowedItemIds: readonly string[];
  readonly cursorExecutionAllowedItemIds: readonly string[];
  readonly githubWriteAllowedItemIds: readonly string[];
  readonly connectorGatewayCallAllowedItemIds: readonly string[];
  readonly dbPersistenceAllowedItemIds: readonly string[];
  readonly productionRunnerAllowedItemIds: readonly string[];
  readonly uiImplementationAllowedItemIds: readonly string[];
  readonly agentRegistryMutationAllowedItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly missingStage13CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage13ItemIds: readonly string[];
}

export interface ExternalExecutionManualDryRunGateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ExternalExecutionManualDryRunGateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ExternalExecutionManualDryRunGateDecisionInput {
  readonly sourceStage11Decision: string;
  readonly sourceStage12EntryReady: boolean;
  readonly sourceManualDryRunGateDesignAllowed: boolean;
  readonly sourceOperatorApprovedDryRunInvocationAllowed: boolean;
  readonly sourceMockExternalAdapterResultPackageAllowed: boolean;
  readonly sourceDryRunAuditEventPackageAllowed: boolean;
  readonly sourceRollbackPlanReviewBeforeActualExecutionAllowed: boolean;
  readonly sourceStage12ManualGateRequiredBeforeActualExecution: boolean;
  readonly sourceActualManualExternalInvocationAllowedInThisStep: boolean;
  readonly sourceActualAdapterSideEffectAllowedInThisStep: boolean;
  readonly sourceActualAgentRegistryMutationAllowedInThisStep: boolean;
  readonly validationValid: boolean;
  readonly stage13EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage13RequiresSeparateApproval: boolean;
  readonly stage13ImplementationAllowedInThisStep: boolean;
}

export interface ExternalExecutionManualDryRunGateReport {
  readonly mode: ExternalExecutionManualDryRunGateMode;
  readonly stage: ExternalExecutionManualDryRunGateStage;
  readonly decision: ExternalExecutionManualDryRunGateDecision;

  readonly sourceStage11Decision: string;
  readonly sourceStage12EntryReady: boolean;
  readonly sourceManualDryRunGateDesignAllowed: boolean;
  readonly sourceOperatorApprovedDryRunInvocationAllowed: boolean;
  readonly sourceMockExternalAdapterResultPackageAllowed: boolean;
  readonly sourceDryRunAuditEventPackageAllowed: boolean;
  readonly sourceRollbackPlanReviewBeforeActualExecutionAllowed: boolean;
  readonly sourceStage12ManualGateRequiredBeforeActualExecution: boolean;

  readonly gateVersion: "external_execution_manual_dry_run_gate_v1";
  readonly gateTitle: string;
  readonly gateSummary: string;
  readonly gateFingerprint: string;

  readonly manualGateOnly: true;
  readonly stage13EntryCandidate: "actual_external_execution_adapter_candidate";
  readonly stage13EntryReady: boolean;
  readonly stage13EntryScope: readonly string[];
  readonly stage13EntryOutOfScope: readonly string[];
  readonly stage13RequiresSeparateApproval: true;
  readonly stage13ImplementationAllowedInThisStep: false;

  readonly actualExternalInvocationImplementedInThisStep: false;
  readonly actualAdapterSideEffectImplementedInThisStep: false;
  readonly actualCursorExecutionImplementedInThisStep: false;
  readonly actualGithubWriteImplementedInThisStep: false;
  readonly actualConnectorGatewayCallImplementedInThisStep: false;
  readonly actualDbPersistenceImplementedInThisStep: false;
  readonly actualProductionRunnerImplementedInThisStep: false;
  readonly actualUiImplementationImplementedInThisStep: false;
  readonly agentRegistryMutationImplementedInThisStep: false;

  readonly actualAdapterCandidateDesignAllowed: true;
  readonly actualAdapterImplementationAllowedInThisStep: false;
  readonly cursorAdapterCandidateAllowed: true;
  readonly githubAdapterCandidateAllowed: true;
  readonly connectorAdapterCandidateAllowed: true;
  readonly runnerAdapterCandidateAllowed: true;
  readonly stage13CandidateBoundaryRequiredBeforeActualImplementation: true;
  readonly actualCursorAdapterImplementedInThisStep: false;
  readonly actualGithubAdapterImplementedInThisStep: false;
  readonly actualConnectorAdapterImplementedInThisStep: false;
  readonly actualRunnerAdapterImplementedInThisStep: false;
  readonly actualAdapterCredentialUsageAllowedInThisStep: false;
  readonly actualNetworkSideEffectAllowedInThisStep: false;

  readonly gateItems: readonly ExternalExecutionManualDryRunGateItem[];
  readonly validation: ExternalExecutionManualDryRunGateValidationResult;
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly ExternalExecutionManualDryRunGateChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionManualDryRunGateChecklistItem[];
  readonly findings: readonly ExternalExecutionManualDryRunGateFinding[];

  readonly itemCount: number;
  readonly stage13CandidateItemCount: number;
  readonly requiredBeforeStage13ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedExternalExecutionManualDryRunGateInput = {
  readonly manualGateReviewed: boolean;
  readonly operatorInvocationReviewed: boolean;
  readonly mockAdapterResultReviewed: boolean;
  readonly dryRunAuditReviewed: boolean;
  readonly rollbackReviewCompleted: boolean;
  readonly noSideEffectBoundaryReviewed: boolean;
  readonly agentRegistryBoundaryReviewed: boolean;
  readonly stage13EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
