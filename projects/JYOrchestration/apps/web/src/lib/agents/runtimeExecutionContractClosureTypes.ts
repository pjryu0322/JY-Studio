/**
 * Stage 6-F runtime execution contract closure (read-only; no implementation permission).
 */

import type { RuntimeExecutionDryRunContractDecision, RuntimeExecutionDryRunContractInput } from "@/lib/agents/runtimeExecutionDryRunContractTypes";

export type RuntimeExecutionContractClosureDecision =
  | "stage6_runtime_execution_contract_closed"
  | "defer"
  | "blocked";

export type RuntimeExecutionContractClosureStage = "stage_6_f_runtime_execution_contract_closure";
export type RuntimeExecutionContractClosureMode = "read_only_runtime_execution_contract_closure";

export type RuntimeExecutionContractClosureArea =
  | "stage6_chain_closure"
  | "runtime_model_baseline"
  | "runtime_model_candidate"
  | "runtime_model_review_gate"
  | "runtime_contract_candidate"
  | "runtime_dry_run_contract"
  | "no_run_boundary"
  | "persistence_boundary"
  | "schema_boundary"
  | "separated_work";

export type RuntimeExecutionContractClosureFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeExecutionContractClosureFinding {
  readonly severity: RuntimeExecutionContractClosureFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionContractClosureChecklistItem {
  readonly item: string;
  readonly area: RuntimeExecutionContractClosureArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionContractClosureInput {
  readonly dryRunContract?: RuntimeExecutionDryRunContractInput;
  readonly runtimeExecutionContractClosureConfirmed?: boolean;
  readonly runtimeExecutionNoActualRunnerConfirmed?: boolean;
  readonly runtimeExecutionNoPersistenceConfirmed?: boolean;
  readonly runtimeExecutionSeparatedWorkReviewed?: boolean;
  readonly runtimeExecutionStage7HandoffReviewed?: boolean;
}

export interface RuntimeExecutionContractClosureReport {
  readonly mode: RuntimeExecutionContractClosureMode;
  readonly stage: RuntimeExecutionContractClosureStage;
  readonly decision: RuntimeExecutionContractClosureDecision;

  readonly sourceDryRunContractDecision: RuntimeExecutionDryRunContractDecision;
  readonly sourceDryRunContractVersion: string;
  readonly sourceDryRunContractFingerprint: string;
  readonly sourceDryRunContractOnly: boolean;
  readonly sourceDryRunContractItemCount: number;
  readonly sourceDryRunScenarioCount: number;
  readonly sourceDryRunAssertionCount: number;
  readonly sourceDryRunContractValidationValid: boolean;

  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;

  readonly closureVersion: "runtime_execution_contract_closure_v1";
  readonly closureTitle: string;
  readonly closureSummary: string;
  readonly closureFingerprint: string;

  readonly stage6ContractClosed: boolean;
  readonly stage6ClosureOnly: true;
  readonly actualRuntimeExecutionAllowedAfterStage6: false;
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
  readonly closureChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly handoffChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly findings: readonly RuntimeExecutionContractClosureFinding[];

  readonly closedStages: readonly string[];
  readonly stage6ClosureSummary: string;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeExecutionContractClosureDecisionInput {
  readonly sourceDryRunContractDecision: RuntimeExecutionDryRunContractDecision;
  readonly sourceDryRunContractOnly: boolean;
  readonly sourceDryRunContractValidationValid: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly sourceDryRunContractItemCount: number;
  readonly sourceDryRunScenarioCount: number;
  readonly sourceDryRunAssertionCount: number;
  readonly confirmationsSatisfied: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
}

export type ParsedRuntimeExecutionContractClosureInput = {
  readonly runtimeExecutionContractClosureConfirmed: boolean;
  readonly runtimeExecutionNoActualRunnerConfirmed: boolean;
  readonly runtimeExecutionNoPersistenceConfirmed: boolean;
  readonly runtimeExecutionSeparatedWorkReviewed: boolean;
  readonly runtimeExecutionStage7HandoffReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
