/**
 * Stage 6-C runtime execution model review gate (read-only; no execution permission).
 */

import type {
  RuntimeExecutionModelCandidateDecision,
  RuntimeExecutionModelCandidateInput,
  RuntimeExecutionModelCandidateKind,
} from "@/lib/agents/runtimeExecutionModelCandidateTypes";

export type RuntimeExecutionModelReviewGateDecision =
  | "ready_for_runtime_execution_contract_candidate"
  | "defer"
  | "blocked";

export type RuntimeExecutionModelReviewGateStage = "stage_6_c_runtime_execution_model_review_gate";
export type RuntimeExecutionModelReviewGateMode = "read_only_runtime_execution_model_review_gate";

export type RuntimeExecutionModelReviewArea =
  | "request_model"
  | "plan_model"
  | "step_model"
  | "result_model"
  | "finding_model"
  | "approval_state_model"
  | "rollback_plan_model"
  | "execution_boundary"
  | "no_run_boundary"
  | "persistence_boundary";

export type RuntimeExecutionModelReviewGateFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeExecutionModelReviewGateChecklistItem {
  readonly item: string;
  readonly area: RuntimeExecutionModelReviewArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionModelReviewGateFinding {
  readonly severity: RuntimeExecutionModelReviewGateFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionModelReviewGateInput {
  readonly modelCandidate?: RuntimeExecutionModelCandidateInput;
  readonly runtimeModelReviewGateConfirmed?: boolean;
  readonly runtimeModelFieldContractReviewed?: boolean;
  readonly runtimeModelNoRunBoundaryReviewed?: boolean;
  readonly runtimeModelPersistenceBoundaryReviewed?: boolean;
  readonly runtimeModelApprovalBoundaryReviewed?: boolean;
}

export interface RuntimeExecutionModelReviewGateReport {
  readonly mode: RuntimeExecutionModelReviewGateMode;
  readonly stage: RuntimeExecutionModelReviewGateStage;
  readonly decision: RuntimeExecutionModelReviewGateDecision;

  readonly sourceModelCandidateDecision: RuntimeExecutionModelCandidateDecision;
  readonly sourceModelCandidateVersion: string;
  readonly sourceModelCandidateFingerprint: string;
  readonly sourceCandidateOnly: true;

  readonly reviewGateVersion: "runtime_execution_model_review_gate_v1";
  readonly reviewGateTitle: string;
  readonly reviewGateSummary: string;
  readonly reviewGateFingerprint: string;

  readonly reviewGateOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualExecutionWireAllowedInThisStep: false;
  readonly actualPersistenceAllowedInThisStep: false;
  readonly actualExternalSideEffectAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;

  readonly requiredConfirmations: readonly string[];
  readonly reviewChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
  readonly noRunChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
  readonly persistenceChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
  readonly findings: readonly RuntimeExecutionModelReviewGateFinding[];

  readonly reviewedModelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly reviewedModelCount: number;
  readonly reviewedFieldCount: number;
  readonly forbiddenFieldDetected: boolean;

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeExecutionModelReviewGateDecisionInput {
  readonly sourceModelCandidateDecision: RuntimeExecutionModelCandidateDecision;
  readonly sourceCandidateOnly: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly forbiddenFieldDetected: boolean;
  readonly noRunBoundarySatisfied: boolean;
  readonly persistenceBoundarySatisfied: boolean;
}
