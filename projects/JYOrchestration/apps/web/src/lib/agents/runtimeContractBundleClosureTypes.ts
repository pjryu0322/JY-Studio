/**
 * Stage 7-C integrated runtime contract bundle closure (read-only; no implementation permission).
 */

import type {
  RuntimeApiContractDesignDecision,
  RuntimeApiContractDesignInput,
} from "@/lib/agents/runtimeApiContractDesignTypes";

export type RuntimeContractBundleClosureDecision =
  | "stage7_runtime_contract_bundle_closed"
  | "defer"
  | "blocked";

export type RuntimeContractBundleClosureStage = "stage_7_c_runtime_contract_bundle_closure";

export type RuntimeContractBundleClosureMode = "read_only_runtime_contract_bundle_closure";

export type RuntimeContractBundleClosureArea =
  | "api_contract"
  | "runner_contract"
  | "dry_run_contract"
  | "cursor_github_wire_contract"
  | "connector_gateway_contract"
  | "persistence_boundary"
  | "schema_boundary"
  | "approval_gate"
  | "security_gate"
  | "rollback_contract"
  | "audit_contract"
  | "stage8_entry"
  | "no_run_boundary"
  | "separated_work";

export type RuntimeContractBundleClosureFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeContractBundleClosureFinding {
  readonly severity: RuntimeContractBundleClosureFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeContractBundleClosureChecklistItem {
  readonly item: string;
  readonly area: RuntimeContractBundleClosureArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeContractBundleClosureInput {
  readonly apiContractDesign?: RuntimeApiContractDesignInput;
  readonly runtimeContractBundleReviewed?: boolean;
  readonly runtimeContractBundleNoImplementationConfirmed?: boolean;
  readonly runtimeContractBundleStage8EntryReviewed?: boolean;
  readonly runtimeContractBundleSeparatedWorkConfirmed?: boolean;
  readonly runtimeContractBundleRollbackReviewed?: boolean;
}

export interface RuntimeContractBundleItem {
  readonly bundleItemId: string;
  readonly area: RuntimeContractBundleClosureArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: "stage7_b_api_contract" | "stage7_a_planning_item" | "stage6_contract_boundary";
  readonly designOnly: true;
  readonly implementedInThisStep: false;
  readonly stage8Candidate: boolean;
  readonly requiredBeforeStage8: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
}

export interface RuntimeContractBundleValidationResult {
  readonly valid: boolean;
  readonly missingBundleItemIds: readonly string[];
  readonly duplicateBundleItemIds: readonly string[];
  readonly implementedInThisStepItemIds: readonly string[];
  readonly emptyApprovalItemIds: readonly string[];
  readonly emptyForbiddenBoundaryItemIds: readonly string[];
  readonly missingStage8CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage8ItemIds: readonly string[];
  readonly nonDesignOnlyItemIds: readonly string[];
  readonly missingStage8ScopeItemIds: readonly string[];
  readonly missingSeparateApprovalItemIds: readonly string[];
}

export interface RuntimeContractBundleClosureReport {
  readonly mode: RuntimeContractBundleClosureMode;
  readonly stage: RuntimeContractBundleClosureStage;
  readonly decision: RuntimeContractBundleClosureDecision;

  readonly sourceApiContractDecision: RuntimeApiContractDesignDecision;
  readonly sourceApiContractVersion: string;
  readonly sourceApiContractFingerprint: string;
  readonly sourceEndpointContractCount: number;
  readonly sourceEndpointDesignOnlyCount: number;
  readonly sourceImplementedEndpointCount: number;

  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
  readonly sourceActualUiImplementationAllowedInThisStep: boolean;

  readonly bundleVersion: "runtime_contract_bundle_closure_v1";
  readonly bundleTitle: string;
  readonly bundleSummary: string;
  readonly bundleFingerprint: string;

  readonly contractBundleClosureOnly: true;
  readonly stage8EntryCandidate: "minimal_runtime_execution_vertical_slice";
  readonly stage8EntryReady: boolean;
  readonly stage8EntryScope: readonly string[];
  readonly stage8EntryOutOfScope: readonly string[];
  readonly stage8EntryRequiresSeparateApproval: true;
  readonly stage8EntryImplementationAllowedInThisStep: false;

  readonly actualApiEndpointImplementedInThisStep: false;
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
  readonly bundleItems: readonly RuntimeContractBundleItem[];
  readonly bundleValidation: RuntimeContractBundleValidationResult;
  readonly closureChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
  readonly stage8EntryChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
  readonly findings: readonly RuntimeContractBundleClosureFinding[];

  readonly bundleItemCount: number;
  readonly stage8CandidateItemCount: number;
  readonly requiredBeforeStage8ItemCount: number;
  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeContractBundleClosureDecisionInput {
  readonly sourceApiContractDecision: RuntimeApiContractDesignDecision;
  readonly sourceEndpointContractCount: number;
  readonly sourceEndpointDesignOnlyCount: number;
  readonly sourceImplementedEndpointCount: number;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
  readonly sourceActualUiImplementationAllowedInThisStep: boolean;
  readonly bundleItemsValid: boolean;
  readonly stage8EntryReady: boolean;
  readonly stage8EntryRequiresSeparateApproval: boolean;
  readonly stage8EntryImplementationAllowedInThisStep: boolean;
  readonly confirmationsSatisfied: boolean;
}

export type ParsedRuntimeContractBundleClosureInput = {
  readonly runtimeContractBundleReviewed: boolean;
  readonly runtimeContractBundleNoImplementationConfirmed: boolean;
  readonly runtimeContractBundleStage8EntryReviewed: boolean;
  readonly runtimeContractBundleSeparatedWorkConfirmed: boolean;
  readonly runtimeContractBundleRollbackReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
