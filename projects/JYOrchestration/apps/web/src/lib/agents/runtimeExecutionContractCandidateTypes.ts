/**
 * Stage 6-D runtime execution contract candidate (read-only; no execution implementation).
 */

import type {
  RuntimeExecutionModelReviewGateDecision,
  RuntimeExecutionModelReviewGateInput,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

export type RuntimeExecutionContractCandidateDecision =
  | "ready_for_runtime_execution_dry_run_contract"
  | "defer"
  | "blocked";

export type RuntimeExecutionContractCandidateStage = "stage_6_d_runtime_execution_contract_candidate";
export type RuntimeExecutionContractCandidateMode = "read_only_runtime_execution_contract_candidate";

export type RuntimeExecutionContractArea =
  | "request_contract"
  | "plan_contract"
  | "step_contract"
  | "result_contract"
  | "finding_contract"
  | "approval_contract"
  | "rollback_contract"
  | "boundary_contract"
  | "dry_run_contract"
  | "no_run_boundary"
  | "persistence_boundary"
  | "schema_boundary";

export interface RuntimeExecutionContractCandidateItem {
  readonly contractId: string;
  readonly area: RuntimeExecutionContractArea;
  readonly modelKind: string;
  readonly contractName: string;
  readonly purpose: string;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
  readonly boundaryRules: readonly string[];
  readonly candidateOnly: true;
  readonly implementedInThisStep: false;
}

export interface RuntimeExecutionContractCandidateChecklistItem {
  readonly item: string;
  readonly area: RuntimeExecutionContractArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export type RuntimeExecutionContractCandidateFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeExecutionContractCandidateFinding {
  readonly severity: RuntimeExecutionContractCandidateFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionContractCandidateInput {
  readonly reviewGate?: RuntimeExecutionModelReviewGateInput;
  readonly runtimeExecutionContractCandidateConfirmed?: boolean;
  readonly runtimeExecutionBoundaryContractReviewed?: boolean;
  readonly runtimeExecutionDryRunContractReviewed?: boolean;
  readonly runtimeExecutionRollbackContractReviewed?: boolean;
  readonly runtimeExecutionApprovalContractReviewed?: boolean;
}

export interface RuntimeExecutionContractCandidateReport {
  readonly mode: RuntimeExecutionContractCandidateMode;
  readonly stage: RuntimeExecutionContractCandidateStage;
  readonly decision: RuntimeExecutionContractCandidateDecision;

  readonly sourceReviewGateDecision: RuntimeExecutionModelReviewGateDecision;
  readonly sourceReviewGateVersion: string;
  readonly sourceReviewGateFingerprint: string;
  readonly sourceReviewGateOnly: boolean;
  readonly sourceCandidateOnly: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;

  readonly contractCandidateVersion: "runtime_execution_contract_candidate_v1";
  readonly contractCandidateTitle: string;
  readonly contractCandidateSummary: string;
  readonly contractCandidateFingerprint: string;

  readonly contractCandidateOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualExecutionRunnerAllowedInThisStep: false;
  readonly actualExecutionWireAllowedInThisStep: false;
  readonly actualPersistenceAllowedInThisStep: false;
  readonly actualExternalSideEffectAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;
  readonly actualCursorGithubWireAllowedInThisStep: false;
  readonly actualConnectorRoutingChangeAllowedInThisStep: false;

  readonly requiredConfirmations: readonly string[];
  readonly contractCandidates: readonly RuntimeExecutionContractCandidateItem[];
  readonly contractChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly dryRunChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly findings: readonly RuntimeExecutionContractCandidateFinding[];

  readonly contractCandidateCount: number;
  readonly contractFieldCount: number;
  readonly contractBoundaryRuleCount: number;
  readonly reviewedModelCount: number;

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeExecutionContractCandidateDecisionInput {
  readonly sourceReviewGateDecision: RuntimeExecutionModelReviewGateDecision;
  readonly sourceReviewGateOnly: boolean;
  readonly sourceCandidateOnly: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly contractCandidatesValid: boolean;
}

export type ParsedRuntimeExecutionContractCandidateInput = {
  readonly runtimeExecutionContractCandidateConfirmed: boolean;
  readonly runtimeExecutionBoundaryContractReviewed: boolean;
  readonly runtimeExecutionDryRunContractReviewed: boolean;
  readonly runtimeExecutionRollbackContractReviewed: boolean;
  readonly runtimeExecutionApprovalContractReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
