/**
 * Stage 6-B runtime execution model candidate (read-only; no schema/API/persistence wire).
 */

import type { RuntimeExecutionModelBaselineInput } from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import type { RuntimeExecutionModelBaselineDecision } from "@/lib/agents/runtimeExecutionModelBaselineTypes";

export type RuntimeExecutionModelCandidateDecision =
  | "ready_for_runtime_execution_model_review"
  | "defer"
  | "blocked";

export type RuntimeExecutionModelCandidateKind =
  | "RuntimeExecutionRequest"
  | "RuntimeExecutionPlan"
  | "RuntimeExecutionStep"
  | "RuntimeExecutionResult"
  | "RuntimeExecutionFinding"
  | "RuntimeExecutionApprovalState"
  | "RuntimeExecutionRollbackPlan";

export interface RuntimeExecutionModelCandidate {
  readonly kind: RuntimeExecutionModelCandidateKind;
  readonly modelName: string;
  readonly purpose: string;
  readonly proposedFields: readonly string[];
  readonly forbiddenFields: readonly string[];
  readonly persistenceCandidateOnly: true;
}

export interface RuntimeExecutionModelCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionModelCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionModelCandidateInput {
  readonly baseline?: RuntimeExecutionModelBaselineInput;
  readonly runtimeModelReviewConfirmed?: boolean;
  readonly runtimeModelNoExecutionWireConfirmed?: boolean;
  readonly runtimeModelNoPersistenceConfirmed?: boolean;
}

export interface RuntimeExecutionModelCandidateReport {
  readonly mode: "read_only_runtime_execution_model_candidate";
  readonly stage: "stage_6_b_runtime_execution_model_candidate";
  readonly decision: RuntimeExecutionModelCandidateDecision;

  readonly sourceBaselineDecision: RuntimeExecutionModelBaselineDecision;
  readonly modelCandidateVersion: "runtime_execution_model_candidate_v1";
  readonly modelCandidateTitle: string;
  readonly modelCandidateSummary: string;
  readonly modelCandidateFingerprint: string;

  readonly candidateOnly: true;
  readonly actualExecutionWireAllowedInThisStep: false;
  readonly actualPersistenceAllowedInThisStep: false;
  readonly actualExternalSideEffectAllowedInThisStep: false;

  readonly modelCandidates: readonly RuntimeExecutionModelCandidate[];
  readonly modelChecklist: readonly RuntimeExecutionModelCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionModelCandidateChecklistItem[];
  readonly findings: readonly RuntimeExecutionModelCandidateFinding[];

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type RuntimeExecutionModelCandidateDecisionInput = {
  readonly sourceBaselineDecision: RuntimeExecutionModelBaselineDecision;
  readonly confirmationsSatisfied: boolean;
  readonly hasRequiredModelKinds: boolean;
  readonly candidatePostureValid: boolean;
};
