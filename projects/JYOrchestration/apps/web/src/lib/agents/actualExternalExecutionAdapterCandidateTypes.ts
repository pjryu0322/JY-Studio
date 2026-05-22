/**
 * Stage 13-A actual external execution adapter candidate types (read-only).
 */

import type { ExternalExecutionManualDryRunGateInput } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export type ActualExternalExecutionAdapterCandidateDecision =
  | "stage13_actual_external_execution_adapter_candidate_ready"
  | "defer"
  | "blocked";

export type ActualExternalExecutionAdapterCandidateStage =
  "stage_13_a_actual_external_execution_adapter_candidate_boundary";

export type ActualExternalExecutionAdapterCandidateMode =
  "read_only_actual_external_execution_adapter_candidate_boundary";

export type ActualExternalExecutionAdapterCandidateArea =
  | "cursor_adapter_candidate"
  | "github_write_adapter_candidate"
  | "connector_gateway_adapter_candidate"
  | "runner_process_adapter_candidate"
  | "adapter_permission_contract"
  | "adapter_result_contract"
  | "adapter_audit_contract"
  | "adapter_rollback_contract"
  | "no_side_effect_candidate_boundary"
  | "agent_registry_change_boundary"
  | "stage14_entry"
  | "separated_work";

export interface ActualExternalExecutionAdapterCandidateInput {
  readonly manualDryRunGate?: ExternalExecutionManualDryRunGateInput;

  readonly cursorAdapterCandidateReviewed?: boolean;
  readonly githubAdapterCandidateReviewed?: boolean;
  readonly connectorAdapterCandidateReviewed?: boolean;
  readonly runnerAdapterCandidateReviewed?: boolean;
  readonly adapterPermissionContractReviewed?: boolean;
  readonly adapterResultContractReviewed?: boolean;
  readonly adapterAuditContractReviewed?: boolean;
  readonly adapterRollbackContractReviewed?: boolean;
  readonly noSideEffectCandidateBoundaryReviewed?: boolean;
  readonly agentRegistryBoundaryReviewed?: boolean;
  readonly stage14EntryReviewed?: boolean;
}

export interface ActualExternalExecutionAdapterCandidateItem {
  readonly itemId: string;
  readonly area: ActualExternalExecutionAdapterCandidateArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage12_a_external_execution_manual_dry_run_gate";
  readonly candidateOnly: true;
  readonly implementedInThisStep: false;
  readonly actualExternalExecutionAllowedInThisStep: false;
  readonly actualCursorAdapterImplementedInThisStep: false;
  readonly actualGithubAdapterImplementedInThisStep: false;
  readonly actualConnectorAdapterImplementedInThisStep: false;
  readonly actualRunnerAdapterImplementedInThisStep: false;
  readonly actualAdapterCredentialUsageAllowedInThisStep: false;
  readonly actualNetworkSideEffectAllowedInThisStep: false;
  readonly actualDbPersistenceAllowedInThisStep: false;
  readonly actualUiImplementationAllowedInThisStep: false;
  readonly agentRegistryMutationAllowedInThisStep: false;
  readonly stage14Candidate: boolean;
  readonly requiredBeforeStage14: boolean;
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
}

export interface ActualExternalExecutionAdapterCandidateValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly implementedItemIds: readonly string[];
  readonly nonCandidateOnlyItemIds: readonly string[];
  readonly externalExecutionAllowedItemIds: readonly string[];
  readonly cursorAdapterImplementedItemIds: readonly string[];
  readonly githubAdapterImplementedItemIds: readonly string[];
  readonly connectorAdapterImplementedItemIds: readonly string[];
  readonly runnerAdapterImplementedItemIds: readonly string[];
  readonly adapterCredentialUsageAllowedItemIds: readonly string[];
  readonly networkSideEffectAllowedItemIds: readonly string[];
  readonly dbPersistenceAllowedItemIds: readonly string[];
  readonly uiImplementationAllowedItemIds: readonly string[];
  readonly agentRegistryMutationAllowedItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly missingStage14CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage14ItemIds: readonly string[];
}

export interface ActualExternalExecutionAdapterCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ActualExternalExecutionAdapterCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ActualExternalExecutionAdapterCandidateDecisionInput {
  readonly sourceStage12Decision: string;
  readonly sourceStage13EntryReady: boolean;
  readonly sourceActualAdapterCandidateDesignAllowed: boolean;
  readonly sourceActualAdapterImplementationAllowedInThisStep: boolean;
  readonly sourceCursorAdapterCandidateAllowed: boolean;
  readonly sourceGithubAdapterCandidateAllowed: boolean;
  readonly sourceConnectorAdapterCandidateAllowed: boolean;
  readonly sourceRunnerAdapterCandidateAllowed: boolean;
  readonly sourceStage13CandidateBoundaryRequiredBeforeActualImplementation: boolean;
  readonly sourceActualCursorAdapterImplementedInThisStep: boolean;
  readonly sourceActualGithubAdapterImplementedInThisStep: boolean;
  readonly sourceActualConnectorAdapterImplementedInThisStep: boolean;
  readonly sourceActualRunnerAdapterImplementedInThisStep: boolean;
  readonly sourceActualAdapterCredentialUsageAllowedInThisStep: boolean;
  readonly sourceActualNetworkSideEffectAllowedInThisStep: boolean;
  readonly validationValid: boolean;
  readonly stage14EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage14RequiresSeparateApproval: boolean;
  readonly stage14ImplementationAllowedInThisStep: boolean;
}

export interface ActualExternalExecutionAdapterCandidateReport {
  readonly mode: ActualExternalExecutionAdapterCandidateMode;
  readonly stage: ActualExternalExecutionAdapterCandidateStage;
  readonly decision: ActualExternalExecutionAdapterCandidateDecision;

  readonly sourceStage12Decision: string;
  readonly sourceStage13EntryReady: boolean;
  readonly sourceActualAdapterCandidateDesignAllowed: boolean;
  readonly sourceActualAdapterImplementationAllowedInThisStep: boolean;
  readonly sourceCursorAdapterCandidateAllowed: boolean;
  readonly sourceGithubAdapterCandidateAllowed: boolean;
  readonly sourceConnectorAdapterCandidateAllowed: boolean;
  readonly sourceRunnerAdapterCandidateAllowed: boolean;
  readonly sourceStage13CandidateBoundaryRequiredBeforeActualImplementation: boolean;

  readonly candidateVersion: "actual_external_execution_adapter_candidate_v1";
  readonly candidateTitle: string;
  readonly candidateSummary: string;
  readonly candidateFingerprint: string;

  readonly candidateOnly: true;
  readonly stage14EntryCandidate: "operator_approved_actual_external_execution";
  readonly stage14EntryReady: boolean;
  readonly stage14EntryScope: readonly string[];
  readonly stage14EntryOutOfScope: readonly string[];
  readonly stage14RequiresSeparateApproval: true;
  readonly stage14ImplementationAllowedInThisStep: false;

  readonly actualExternalExecutionImplementedInThisStep: false;
  readonly actualCursorAdapterImplementedInThisStep: false;
  readonly actualGithubAdapterImplementedInThisStep: false;
  readonly actualConnectorAdapterImplementedInThisStep: false;
  readonly actualRunnerAdapterImplementedInThisStep: false;
  readonly actualAdapterCredentialUsageAllowedInThisStep: false;
  readonly actualNetworkSideEffectAllowedInThisStep: false;
  readonly actualDbPersistenceImplementedInThisStep: false;
  readonly actualUiImplementationImplementedInThisStep: false;
  readonly agentRegistryMutationImplementedInThisStep: false;

  readonly candidateItems: readonly ActualExternalExecutionAdapterCandidateItem[];
  readonly validation: ActualExternalExecutionAdapterCandidateValidationResult;
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly ActualExternalExecutionAdapterCandidateChecklistItem[];
  readonly boundaryChecklist: readonly ActualExternalExecutionAdapterCandidateChecklistItem[];
  readonly findings: readonly ActualExternalExecutionAdapterCandidateFinding[];

  readonly itemCount: number;
  readonly stage14CandidateItemCount: number;
  readonly requiredBeforeStage14ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedActualExternalExecutionAdapterCandidateInput = {
  readonly cursorAdapterCandidateReviewed: boolean;
  readonly githubAdapterCandidateReviewed: boolean;
  readonly connectorAdapterCandidateReviewed: boolean;
  readonly runnerAdapterCandidateReviewed: boolean;
  readonly adapterPermissionContractReviewed: boolean;
  readonly adapterResultContractReviewed: boolean;
  readonly adapterAuditContractReviewed: boolean;
  readonly adapterRollbackContractReviewed: boolean;
  readonly noSideEffectCandidateBoundaryReviewed: boolean;
  readonly agentRegistryBoundaryReviewed: boolean;
  readonly stage14EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
