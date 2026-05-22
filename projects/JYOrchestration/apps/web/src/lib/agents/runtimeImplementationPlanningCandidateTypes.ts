/**
 * Stage 7-A runtime implementation planning candidate (read-only; no implementation permission).
 */

import type {
  RuntimeExecutionContractClosureDecision,
  RuntimeExecutionContractClosureInput,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";

export type RuntimeImplementationPlanningCandidateDecision =
  | "ready_for_runtime_implementation_pr_planning"
  | "defer"
  | "blocked";

export type RuntimeImplementationPlanningCandidateStage =
  "stage_7_a_runtime_implementation_planning_candidate";

export type RuntimeImplementationPlanningCandidateMode =
  "read_only_runtime_implementation_planning_candidate";

export type RuntimeImplementationPlanningCandidateArea =
  | "implementation_planning"
  | "runtime_api"
  | "execution_runner"
  | "dry_run_runner"
  | "cursor_github_wire"
  | "connector_gateway_routing"
  | "persistence"
  | "schema_migration"
  | "feature_flag"
  | "ui"
  | "approval"
  | "rollback"
  | "separated_work";

export type RuntimeImplementationPlanningCandidateFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeImplementationPlanningCandidateFinding {
  readonly severity: RuntimeImplementationPlanningCandidateFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeImplementationPlanningCandidateChecklistItem {
  readonly item: string;
  readonly area: RuntimeImplementationPlanningCandidateArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeImplementationPlanningCandidateInput {
  readonly contractClosure?: RuntimeExecutionContractClosureInput;
  readonly runtimeImplementationPlanningReviewed?: boolean;
  readonly runtimeImplementationSeparatePrConfirmed?: boolean;
  readonly runtimeImplementationNoActualExecutionConfirmed?: boolean;
  readonly runtimeImplementationRollbackPlanReviewed?: boolean;
  readonly runtimeImplementationOperatorApprovalRequiredConfirmed?: boolean;
}

export interface RuntimeImplementationPlanningItem {
  readonly planningItemId: string;
  readonly area: RuntimeImplementationPlanningCandidateArea;
  readonly title: string;
  readonly purpose: string;
  readonly recommendedPrType: "separate_pr" | "design_pr" | "approval_pr";
  readonly dependsOn: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
  readonly candidateOnly: true;
  readonly implementedInThisStep: false;
}

export interface RuntimeImplementationPlanningValidationResult {
  readonly valid: boolean;
  readonly missingPlanningItemIds: readonly string[];
  readonly duplicatePlanningItemIds: readonly string[];
  readonly invalidPrTypeItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly implementedInThisStepItemIds: readonly string[];
}

export interface RuntimeImplementationPlanningCandidateReport {
  readonly mode: RuntimeImplementationPlanningCandidateMode;
  readonly stage: RuntimeImplementationPlanningCandidateStage;
  readonly decision: RuntimeImplementationPlanningCandidateDecision;

  readonly sourceContractClosureDecision: RuntimeExecutionContractClosureDecision;
  readonly sourceContractClosureVersion: string;
  readonly sourceContractClosureFingerprint: string;
  readonly sourceStage6ContractClosed: boolean;
  readonly sourceStage6ClosureOnly: boolean;
  readonly sourceActualRuntimeExecutionAllowedAfterStage6: boolean;

  readonly planningVersion: "runtime_implementation_planning_candidate_v1";
  readonly planningTitle: string;
  readonly planningSummary: string;
  readonly planningFingerprint: string;

  readonly planningCandidateOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualExecutionRunnerAllowedInThisStep: false;
  readonly actualDryRunRunnerAllowedInThisStep: false;
  readonly actualExecutionWireAllowedInThisStep: false;
  readonly actualPersistenceAllowedInThisStep: false;
  readonly actualExternalSideEffectAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;
  readonly actualCursorGithubWireAllowedInThisStep: false;
  readonly actualConnectorRoutingChangeAllowedInThisStep: false;
  readonly actualUiImplementationAllowedInThisStep: false;

  readonly requiredConfirmations: readonly string[];
  readonly planningItems: readonly RuntimeImplementationPlanningItem[];
  readonly planningChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly approvalChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly findings: readonly RuntimeImplementationPlanningCandidateFinding[];

  readonly planningItemCount: number;
  readonly separatedPrCandidateCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeImplementationPlanningCandidateDecisionInput {
  readonly sourceContractClosureDecision: RuntimeExecutionContractClosureDecision;
  readonly sourceStage6ContractClosed: boolean;
  readonly sourceStage6ClosureOnly: boolean;
  readonly sourceActualRuntimeExecutionAllowedAfterStage6: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly planningItemsValid: boolean;
  readonly confirmationsSatisfied: boolean;
}

export type ParsedRuntimeImplementationPlanningCandidateInput = {
  readonly runtimeImplementationPlanningReviewed: boolean;
  readonly runtimeImplementationSeparatePrConfirmed: boolean;
  readonly runtimeImplementationNoActualExecutionConfirmed: boolean;
  readonly runtimeImplementationRollbackPlanReviewed: boolean;
  readonly runtimeImplementationOperatorApprovalRequiredConfirmed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
