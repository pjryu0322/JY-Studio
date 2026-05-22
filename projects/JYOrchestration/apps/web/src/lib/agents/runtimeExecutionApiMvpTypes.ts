/**
 * Stage 9-A runtime execution API + in-memory store MVP types.
 */

import type { RuntimeControlBundleInput } from "@/lib/agents/runtimeControlBundleTypes";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionRecord,
  RuntimeExecutionStatus,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export type RuntimeExecutionApiMvpDecision =
  | "stage9_runtime_execution_api_mvp_ready"
  | "defer"
  | "blocked";

export type RuntimeExecutionApiMvpStage = "stage_9_a_runtime_execution_api_and_in_memory_store";

export type RuntimeExecutionApiMvpMode = "in_memory_runtime_execution_api_mvp";

export type RuntimeExecutionApiAction = "create" | "get" | "list" | "approve" | "mock_run" | "audit";

export interface RuntimeExecutionApiMvpInput {
  readonly runtimeControlBundle?: RuntimeControlBundleInput;
  readonly operatorStage9ApprovalConfirmed?: boolean;
  readonly apiRouteScopeConfirmed?: boolean;
  readonly inMemoryStoreConfirmed?: boolean;
  readonly mockRunnerAdapterConfirmed?: boolean;
  readonly noDbPersistenceConfirmed?: boolean;
  readonly noExternalExecutionConfirmed?: boolean;
}

export interface RuntimeExecutionApiCreateRequest {
  readonly projectId: string;
  readonly commandPreview: string;
  readonly payloadPreview: string;
  readonly requestedBy: "operator" | "system";
}

export interface RuntimeExecutionApiBoundaryReport {
  readonly inMemoryOnly: true;
  readonly actualExternalExecutionAllowed: false;
  readonly actualCursorGithubCallAllowed: false;
  readonly actualConnectorGatewayCallAllowed: false;
  readonly actualDbWriteAllowed: false;
  readonly actualSchemaMigrationAllowed: false;
  readonly actualUiMutationAllowed: false;
}

export interface RuntimeExecutionApiResponse<T = unknown> {
  readonly ok: boolean;
  readonly status: number;
  readonly action: RuntimeExecutionApiAction;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly boundary: RuntimeExecutionApiBoundaryReport;
}

export interface RuntimeExecutionApiMvpStoreSnapshot {
  readonly records: readonly RuntimeExecutionRecord[];
  readonly auditEvents: readonly RuntimeExecutionAuditEvent[];
}

export interface RuntimeExecutionApiMvpApprovalResult {
  readonly executionId: string;
  readonly approved: boolean;
  readonly statusBefore: RuntimeExecutionStatus;
  readonly statusAfter: RuntimeExecutionStatus;
  readonly auditEvent: RuntimeExecutionAuditEvent;
}

export interface RuntimeExecutionApiMvpMockRunResult {
  readonly executionId: string;
  readonly statusBefore: RuntimeExecutionStatus;
  readonly statusAfter: RuntimeExecutionStatus;
  readonly success: boolean;
  readonly auditEvents: readonly RuntimeExecutionAuditEvent[];
}

export interface RuntimeExecutionApiMvpFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionApiMvpChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionApiMvpDecisionInput {
  readonly sourceDecision: string;
  readonly sourceStage9EntryReady: boolean;
  readonly sourceStage9EntryMode: string;
  readonly sourceStage9ActualExternalExecutionAllowed: boolean;
  readonly sourceStage9DbPersistenceAllowed: boolean;
  readonly sourceStage9UiImplementationAllowed: boolean;
  readonly confirmationsSatisfied: boolean;
}

export interface RuntimeExecutionApiMvpReport {
  readonly mode: RuntimeExecutionApiMvpMode;
  readonly stage: RuntimeExecutionApiMvpStage;
  readonly decision: RuntimeExecutionApiMvpDecision;

  readonly sourceStage8Decision: string;
  readonly sourceStage9EntryReady: boolean;
  readonly sourceStage9EntryMode: string;
  readonly sourceStage9ActualExternalExecutionAllowed: boolean;
  readonly sourceStage9DbPersistenceAllowed: boolean;
  readonly sourceStage9UiImplementationAllowed: boolean;

  readonly apiMvpVersion: "runtime_execution_api_mvp_v1";
  readonly apiMvpTitle: string;
  readonly apiMvpSummary: string;
  readonly apiMvpFingerprint: string;

  readonly actualApiRouteImplementedInThisStep: true;
  readonly inMemoryStoreImplementedInThisStep: true;
  readonly mockRunnerAdapterImplementedInThisStep: true;
  readonly actualExternalExecutionAllowedInThisStep: false;
  readonly actualCursorGithubCallAllowedInThisStep: false;
  readonly actualConnectorGatewayCallAllowedInThisStep: false;
  readonly actualDbWriteAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;
  readonly actualUiImplementationAllowedInThisStep: false;

  readonly supportedActions: readonly RuntimeExecutionApiAction[];
  readonly endpointContracts: readonly string[];
  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly RuntimeExecutionApiMvpChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionApiMvpChecklistItem[];
  readonly findings: readonly RuntimeExecutionApiMvpFinding[];

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type ParsedRuntimeExecutionApiMvpInput = {
  readonly operatorStage9ApprovalConfirmed: boolean;
  readonly apiRouteScopeConfirmed: boolean;
  readonly inMemoryStoreConfirmed: boolean;
  readonly mockRunnerAdapterConfirmed: boolean;
  readonly noDbPersistenceConfirmed: boolean;
  readonly noExternalExecutionConfirmed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
};
