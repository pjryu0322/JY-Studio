/**
 * Stage 6-E runtime execution dry-run contract (read-only; no dry-run runner implementation).
 */

import type {
  RuntimeExecutionContractCandidateDecision,
  RuntimeExecutionContractCandidateInput,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type { RuntimeExecutionModelReviewGateDecision } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

export type RuntimeExecutionDryRunContractDecision =
  | "ready_for_runtime_execution_contract_closure"
  | "defer"
  | "blocked";

export type RuntimeExecutionDryRunContractStage = "stage_6_e_runtime_execution_dry_run_contract";
export type RuntimeExecutionDryRunContractMode = "read_only_runtime_execution_dry_run_contract";

export type RuntimeExecutionDryRunContractArea =
  | "dry_run_request"
  | "dry_run_plan"
  | "dry_run_step"
  | "dry_run_result"
  | "dry_run_finding"
  | "dry_run_approval"
  | "dry_run_rollback"
  | "dry_run_boundary"
  | "no_run_boundary"
  | "persistence_boundary"
  | "schema_boundary";

export interface RuntimeExecutionDryRunContractItem {
  readonly dryRunContractId: string;
  readonly area: RuntimeExecutionDryRunContractArea;
  readonly sourceContractId: string;
  readonly scenarioName: string;
  readonly purpose: string;
  readonly requiredInputs: readonly string[];
  readonly expectedAssertions: readonly string[];
  readonly boundaryRules: readonly string[];
  readonly dryRunOnly: true;
  readonly implementedInThisStep: false;
}

export interface RuntimeExecutionDryRunContractValidationResult {
  readonly valid: boolean;
  readonly missingDryRunContractIds: readonly string[];
  readonly duplicateDryRunContractIds: readonly string[];
  readonly emptyRequiredInputContractIds: readonly string[];
  readonly insufficientAssertionContractIds: readonly string[];
  readonly invalidBoundaryRuleContractIds: readonly string[];
  readonly implementedInThisStepContractIds: readonly string[];
}

export type RuntimeExecutionDryRunContractFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeExecutionDryRunContractFinding {
  readonly severity: RuntimeExecutionDryRunContractFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionDryRunContractChecklistItem {
  readonly item: string;
  readonly area: RuntimeExecutionDryRunContractArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionDryRunContractInput {
  readonly contractCandidate?: RuntimeExecutionContractCandidateInput;
  readonly runtimeExecutionDryRunContractConfirmed?: boolean;
  readonly runtimeExecutionDryRunBoundaryReviewed?: boolean;
  readonly runtimeExecutionDryRunNoRunnerConfirmed?: boolean;
  readonly runtimeExecutionDryRunPersistenceReviewed?: boolean;
  readonly runtimeExecutionDryRunRollbackReviewed?: boolean;
}

export interface RuntimeExecutionDryRunContractReport {
  readonly mode: RuntimeExecutionDryRunContractMode;
  readonly stage: RuntimeExecutionDryRunContractStage;
  readonly decision: RuntimeExecutionDryRunContractDecision;

  readonly sourceContractCandidateDecision: RuntimeExecutionContractCandidateDecision;
  readonly sourceContractCandidateVersion: string;
  readonly sourceContractCandidateFingerprint: string;
  readonly sourceContractCandidateOnly: boolean;
  readonly sourceContractCandidateCount: number;
  readonly sourceContractFieldCount: number;
  readonly sourceContractBoundaryRuleCount: number;

  readonly sourceReviewGateDecision: RuntimeExecutionModelReviewGateDecision;
  readonly sourceReviewGateOnly: boolean;
  readonly sourceCandidateOnly: boolean;
  readonly sourceReviewedModelCount: number;
  readonly sourceReviewedFieldCount: number;
  readonly sourceForbiddenFieldDetected: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly sourceContractCandidateValidationValid: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;

  readonly dryRunContractVersion: "runtime_execution_dry_run_contract_v1";
  readonly dryRunContractTitle: string;
  readonly dryRunContractSummary: string;
  readonly dryRunContractFingerprint: string;
  readonly dryRunContractValidation: RuntimeExecutionDryRunContractValidationResult;

  readonly dryRunContractOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualExecutionRunnerAllowedInThisStep: false;
  readonly actualDryRunRunnerAllowedInThisStep: false;
  readonly actualExecutionWireAllowedInThisStep: false;
  readonly actualPersistenceAllowedInThisStep: false;
  readonly actualExternalSideEffectAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;
  readonly actualCursorGithubWireAllowedInThisStep: false;
  readonly actualConnectorRoutingChangeAllowedInThisStep: false;

  readonly requiredConfirmations: readonly string[];
  readonly dryRunContractItems: readonly RuntimeExecutionDryRunContractItem[];
  readonly dryRunChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
  readonly findings: readonly RuntimeExecutionDryRunContractFinding[];

  readonly dryRunContractItemCount: number;
  readonly dryRunScenarioCount: number;
  readonly dryRunAssertionCount: number;

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeExecutionDryRunContractDecisionInput {
  readonly sourceContractCandidateDecision: RuntimeExecutionContractCandidateDecision;
  readonly sourceReviewGateOnly: boolean;
  readonly sourceCandidateOnly: boolean;
  readonly sourceContractCandidateOnly: boolean;
  readonly sourceContractCandidateValidationValid: boolean;
  readonly sourceForbiddenFieldDetected: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly sourceContractCandidateCount: number;
  readonly confirmationsSatisfied: boolean;
  readonly dryRunContractItemsValid: boolean;
}

export type ParsedRuntimeExecutionDryRunContractInput = {
  readonly runtimeExecutionDryRunContractConfirmed: boolean;
  readonly runtimeExecutionDryRunBoundaryReviewed: boolean;
  readonly runtimeExecutionDryRunNoRunnerConfirmed: boolean;
  readonly runtimeExecutionDryRunPersistenceReviewed: boolean;
  readonly runtimeExecutionDryRunRollbackReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
