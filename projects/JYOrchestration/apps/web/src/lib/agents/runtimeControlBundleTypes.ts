/**
 * Stage 8-B integrated runtime control bundle (read-only; no implementation permission).
 */

import type { RuntimeExecutionVerticalSliceInput } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export type RuntimeControlBundleDecision =
  | "stage8_runtime_control_bundle_ready"
  | "defer"
  | "blocked";

export type RuntimeControlBundleStage = "stage_8_b_integrated_runtime_control_bundle";

export type RuntimeControlBundleMode = "read_only_runtime_control_bundle";

export type RuntimeControlBundleArea =
  | "api_route_design_candidate"
  | "runner_adapter_design_candidate"
  | "mock_runner_adapter_candidate"
  | "state_transition_contract"
  | "audit_event_contract"
  | "approval_boundary"
  | "no_run_boundary"
  | "stage9_entry"
  | "separated_work";

export interface RuntimeControlBundleInput {
  readonly verticalSlice?: RuntimeExecutionVerticalSliceInput;
  readonly runtimeControlBundleReviewed?: boolean;
  readonly apiRouteDesignReviewed?: boolean;
  readonly runnerAdapterDesignReviewed?: boolean;
  readonly stateTransitionReviewed?: boolean;
  readonly auditTrailReviewed?: boolean;
  readonly stage9EntryReviewed?: boolean;
}

export interface RuntimeControlBundleItem {
  readonly itemId: string;
  readonly area: RuntimeControlBundleArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage8_a_vertical_slice" | "stage7_c_contract_bundle";
  readonly designOnly: true;
  readonly implementedInThisStep: false;
  readonly stage9Candidate: boolean;
  readonly requiredBeforeStage9: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
}

export interface RuntimeControlBundleValidationResult {
  readonly valid: boolean;
  readonly missingItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
  readonly implementedItemIds: readonly string[];
  readonly nonDesignOnlyItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly missingStage9CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage9ItemIds: readonly string[];
}

export interface RuntimeControlBundleFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeControlBundleChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeControlBundleReport {
  readonly mode: RuntimeControlBundleMode;
  readonly stage: RuntimeControlBundleStage;
  readonly decision: RuntimeControlBundleDecision;

  readonly sourceStage8Decision: string;
  readonly sourceChainExecuted: boolean;
  readonly sourceFinalStatus: string;
  readonly sourceInMemoryOnly: boolean;
  readonly sourceMockRunnerOnly: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualApiRouteAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubCallAllowedInThisStep: boolean;
  readonly sourceActualConnectorGatewayCallAllowedInThisStep: boolean;
  readonly sourceActualDbWriteAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualUiAllowedInThisStep: boolean;

  readonly controlBundleVersion: "runtime_control_bundle_v1";
  readonly controlBundleTitle: string;
  readonly controlBundleSummary: string;
  readonly controlBundleFingerprint: string;

  readonly controlBundleOnly: true;
  readonly stage9EntryCandidate: "runtime_execution_orchestration_mvp";
  readonly stage9EntryReady: boolean;
  readonly stage9EntryScope: readonly string[];
  readonly stage9EntryOutOfScope: readonly string[];
  readonly stage9RequiresSeparateApproval: true;
  readonly stage9ImplementationAllowedInThisStep: false;

  readonly stage9EntryMode: "in_memory_runtime_execution_api_mvp";
  readonly stage9ApiRouteDesignAllowed: true;
  readonly stage9InMemoryStoreAllowed: true;
  readonly stage9MockRunnerAdapterAllowed: true;
  readonly stage9ActualExternalExecutionAllowed: false;
  readonly stage9DbPersistenceAllowed: false;
  readonly stage9UiImplementationAllowed: false;

  readonly actualApiRouteImplementedInThisStep: false;
  readonly actualRunnerImplementedInThisStep: false;
  readonly actualDryRunRunnerImplementedInThisStep: false;
  readonly actualCursorGithubWireImplementedInThisStep: false;
  readonly actualDbWriteImplementedInThisStep: false;
  readonly actualSchemaMigrationImplementedInThisStep: false;
  readonly actualUiImplementedInThisStep: false;

  readonly requiredConfirmations: readonly string[];
  readonly controlItems: readonly RuntimeControlBundleItem[];
  readonly validation: RuntimeControlBundleValidationResult;
  readonly checklist: readonly RuntimeControlBundleChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeControlBundleChecklistItem[];
  readonly findings: readonly RuntimeControlBundleFinding[];

  readonly itemCount: number;
  readonly stage9CandidateItemCount: number;
  readonly requiredBeforeStage9ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeControlBundleDecisionInput {
  readonly sourceStage8Decision: string;
  readonly sourceChainExecuted: boolean;
  readonly sourceFinalStatus: string;
  readonly sourceInMemoryOnly: boolean;
  readonly sourceMockRunnerOnly: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualApiRouteAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubCallAllowedInThisStep: boolean;
  readonly sourceActualConnectorGatewayCallAllowedInThisStep: boolean;
  readonly sourceActualDbWriteAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualUiAllowedInThisStep: boolean;
  readonly validationValid: boolean;
  readonly stage9EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly stage9RequiresSeparateApproval: boolean;
  readonly stage9ImplementationAllowedInThisStep: boolean;
}

export type ParsedRuntimeControlBundleInput = {
  readonly runtimeControlBundleReviewed: boolean;
  readonly apiRouteDesignReviewed: boolean;
  readonly runnerAdapterDesignReviewed: boolean;
  readonly stateTransitionReviewed: boolean;
  readonly auditTrailReviewed: boolean;
  readonly stage9EntryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
