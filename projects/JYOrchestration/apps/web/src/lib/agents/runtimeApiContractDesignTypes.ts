/**
 * Stage 7-B runtime API contract design (read-only; no API endpoint implementation).
 */

import type {
  RuntimeImplementationPlanningCandidateDecision,
  RuntimeImplementationPlanningCandidateInput,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

export type RuntimeApiContractDesignDecision =
  | "ready_for_execution_runner_contract_design"
  | "defer"
  | "blocked";

export type RuntimeApiContractDesignStage = "stage_7_b_runtime_api_contract_design";

export type RuntimeApiContractDesignMode = "read_only_runtime_api_contract_design";

export type RuntimeApiContractDesignArea =
  | "api_contract"
  | "request_contract"
  | "response_contract"
  | "status_contract"
  | "error_contract"
  | "approval_contract"
  | "rollback_contract"
  | "audit_contract"
  | "security_contract"
  | "no_run_boundary"
  | "persistence_boundary"
  | "separated_work";

export type RuntimeApiContractDesignFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeApiContractDesignFinding {
  readonly severity: RuntimeApiContractDesignFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeApiContractDesignChecklistItem {
  readonly item: string;
  readonly area: RuntimeApiContractDesignArea;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeApiContractDesignInput {
  readonly implementationPlanning?: RuntimeImplementationPlanningCandidateInput;
  readonly runtimeApiContractReviewed?: boolean;
  readonly runtimeApiNoEndpointImplementationConfirmed?: boolean;
  readonly runtimeApiNoPersistenceConfirmed?: boolean;
  readonly runtimeApiSecurityBoundaryReviewed?: boolean;
  readonly runtimeApiApprovalBoundaryReviewed?: boolean;
}

export interface RuntimeApiEndpointContract {
  readonly endpointId: string;
  readonly method: "POST" | "GET" | "PATCH";
  readonly pathPattern: string;
  readonly purpose: string;
  readonly requestContract: string;
  readonly responseContract: string;
  readonly statusTransitions: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly errorCodes: readonly string[];
  readonly auditEvents: readonly string[];
  readonly endpointDesignOnly: true;
  readonly implementedInThisStep: false;
}

export interface RuntimeApiEndpointContractValidationResult {
  readonly valid: boolean;
  readonly missingEndpointContractIds: readonly string[];
  readonly duplicateEndpointContractIds: readonly string[];
  readonly emptyPathEndpointIds: readonly string[];
  readonly emptyRequestContractEndpointIds: readonly string[];
  readonly emptyResponseContractEndpointIds: readonly string[];
  readonly missingApprovalEndpointIds: readonly string[];
  readonly insufficientErrorCodeEndpointIds: readonly string[];
  readonly missingAuditEventEndpointIds: readonly string[];
  readonly implementedInThisStepEndpointIds: readonly string[];
}

export interface RuntimeApiContractDesignReport {
  readonly mode: RuntimeApiContractDesignMode;
  readonly stage: RuntimeApiContractDesignStage;
  readonly decision: RuntimeApiContractDesignDecision;

  readonly sourcePlanningDecision: RuntimeImplementationPlanningCandidateDecision;
  readonly sourcePlanningVersion: string;
  readonly sourcePlanningFingerprint: string;
  readonly sourcePlanningCandidateOnly: boolean;
  readonly sourcePlanningItemCount: number;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;

  readonly apiContractVersion: "runtime_api_contract_design_v1";
  readonly apiContractTitle: string;
  readonly apiContractSummary: string;
  readonly apiContractFingerprint: string;

  readonly apiContractDesignOnly: true;
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
  readonly endpointContracts: readonly RuntimeApiEndpointContract[];
  readonly apiChecklist: readonly RuntimeApiContractDesignChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeApiContractDesignChecklistItem[];
  readonly approvalChecklist: readonly RuntimeApiContractDesignChecklistItem[];
  readonly findings: readonly RuntimeApiContractDesignFinding[];

  readonly endpointContractCount: number;
  readonly statusTransitionCount: number;
  readonly errorCodeCount: number;
  readonly auditEventCount: number;

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface RuntimeApiContractDesignDecisionInput {
  readonly sourcePlanningDecision: RuntimeImplementationPlanningCandidateDecision;
  readonly sourcePlanningCandidateOnly: boolean;
  readonly sourcePlanningItemCount: number;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
  readonly endpointContractsValid: boolean;
  readonly confirmationsSatisfied: boolean;
}

export type ParsedRuntimeApiContractDesignInput = {
  readonly runtimeApiContractReviewed: boolean;
  readonly runtimeApiNoEndpointImplementationConfirmed: boolean;
  readonly runtimeApiNoPersistenceConfirmed: boolean;
  readonly runtimeApiSecurityBoundaryReviewed: boolean;
  readonly runtimeApiApprovalBoundaryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
