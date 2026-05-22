/**
 * Stage 9-B integrated runtime MVP closure bundle types (read-only).
 */

import type { RuntimeExecutionApiMvpInput } from "@/lib/agents/runtimeExecutionApiMvpTypes";

export type RuntimeExecutionMvpClosureDecision =
  | "stage9_runtime_api_mvp_closed"
  | "defer"
  | "blocked";

export type RuntimeExecutionMvpClosureStage = "stage_9_b_integrated_runtime_runner_closure_bundle";

export type RuntimeExecutionMvpClosureMode = "read_only_runtime_mvp_closure_bundle";

export type RuntimeExecutionMvpClosureArea =
  | "api_route"
  | "in_memory_store"
  | "approval"
  | "mock_runner_adapter"
  | "status_query"
  | "audit_query"
  | "boundary"
  | "stage10_entry"
  | "separated_work";

export interface RuntimeExecutionMvpClosureInput {
  readonly apiMvp?: RuntimeExecutionApiMvpInput;
  readonly runtimeMvpClosureReviewed?: boolean;
  readonly apiRouteReviewed?: boolean;
  readonly storeLifecycleReviewed?: boolean;
  readonly mockRunnerAdapterReviewed?: boolean;
  readonly auditTrailReviewed?: boolean;
  readonly stage10EntryReviewed?: boolean;
}

export interface RuntimeExecutionMvpClosureItem {
  readonly itemId: string;
  readonly area: RuntimeExecutionMvpClosureArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage9_a_runtime_execution_api_mvp";
  readonly mvpImplemented: boolean;
  readonly actualExternalExecution: false;
  readonly dbPersistence: false;
  readonly productionRunner: false;
  readonly stage10Candidate: boolean;
  readonly requiredBeforeStage10: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
}

export interface RuntimeExecutionMvpClosureValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly externalExecutionItemIds: readonly string[];
  readonly dbPersistenceItemIds: readonly string[];
  readonly productionRunnerItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly missingStage10CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage10ItemIds: readonly string[];
}

export interface RuntimeExecutionMvpClosureFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionMvpClosureChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionMvpClosureDecisionInput {
  readonly sourceStage9Decision: string;
  readonly sourceStage9AClosureReady: boolean;
  readonly sourceActualApiRouteImplementedInThisStep: boolean;
  readonly sourceInMemoryStoreImplementedInThisStep: boolean;
  readonly sourceMockRunnerAdapterImplementedInThisStep: boolean;
  readonly sourceActualExternalExecutionAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubCallAllowedInThisStep: boolean;
  readonly sourceActualConnectorGatewayCallAllowedInThisStep: boolean;
  readonly sourceActualDbWriteAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualUiImplementationAllowedInThisStep: boolean;
  readonly validationValid: boolean;
  readonly stage10EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage10RequiresSeparateApproval: boolean;
  readonly stage10ImplementationAllowedInThisStep: boolean;
}

export interface RuntimeExecutionMvpClosureReport {
  readonly mode: RuntimeExecutionMvpClosureMode;
  readonly stage: RuntimeExecutionMvpClosureStage;
  readonly decision: RuntimeExecutionMvpClosureDecision;

  readonly sourceStage9Decision: string;
  readonly sourceStage9AClosureReady: boolean;
  readonly sourceActualApiRouteImplementedInThisStep: boolean;
  readonly sourceInMemoryStoreImplementedInThisStep: boolean;
  readonly sourceMockRunnerAdapterImplementedInThisStep: boolean;
  readonly sourceActualExternalExecutionAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubCallAllowedInThisStep: boolean;
  readonly sourceActualConnectorGatewayCallAllowedInThisStep: boolean;
  readonly sourceActualDbWriteAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualUiImplementationAllowedInThisStep: boolean;

  readonly closureVersion: "runtime_execution_mvp_closure_v1";
  readonly closureTitle: string;
  readonly closureSummary: string;
  readonly closureFingerprint: string;

  readonly stage10EntryCandidate: "external_execution_adapter_design";
  readonly stage10EntryReady: boolean;
  readonly stage10EntryScope: readonly string[];
  readonly stage10EntryOutOfScope: readonly string[];
  readonly stage10RequiresSeparateApproval: true;
  readonly stage10ImplementationAllowedInThisStep: false;

  readonly closureItems: readonly RuntimeExecutionMvpClosureItem[];
  readonly validation: RuntimeExecutionMvpClosureValidationResult;
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly RuntimeExecutionMvpClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionMvpClosureChecklistItem[];
  readonly findings: readonly RuntimeExecutionMvpClosureFinding[];

  readonly itemCount: number;
  readonly stage10CandidateItemCount: number;
  readonly requiredBeforeStage10ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedRuntimeExecutionMvpClosureInput = {
  readonly runtimeMvpClosureReviewed: boolean;
  readonly apiRouteReviewed: boolean;
  readonly storeLifecycleReviewed: boolean;
  readonly mockRunnerAdapterReviewed: boolean;
  readonly auditTrailReviewed: boolean;
  readonly stage10EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
