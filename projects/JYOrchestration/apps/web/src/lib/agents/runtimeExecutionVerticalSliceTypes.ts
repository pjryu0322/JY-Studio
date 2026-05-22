/**
 * Stage 8-A minimal runtime execution vertical slice (in-memory; no external side effects).
 */

import type { RuntimeContractBundleClosureInput } from "@/lib/agents/runtimeContractBundleClosureTypes";

export type RuntimeExecutionVerticalSliceDecision =
  | "stage8_minimal_vertical_slice_ready"
  | "defer"
  | "blocked";

export type RuntimeExecutionVerticalSliceStage = "stage_8_a_minimal_runtime_execution_vertical_slice";

export type RuntimeExecutionVerticalSliceMode = "in_memory_mock_runtime_execution";

export type RuntimeExecutionStatus =
  | "requested"
  | "validated"
  | "mock_running"
  | "mock_completed"
  | "mock_failed"
  | "cancelled"
  | "rollback_requested";

export type RuntimeExecutionUnitKind =
  | "runtime_request"
  | "mock_runner"
  | "status_transition"
  | "audit_event"
  | "rollback_signal";

export type RuntimeExecutionVerticalSliceFindingSeverity = "info" | "warning" | "blocking";

export interface RuntimeExecutionVerticalSliceFinding {
  readonly severity: RuntimeExecutionVerticalSliceFindingSeverity;
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionVerticalSliceChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionRequest {
  readonly requestId: string;
  readonly projectId: string;
  readonly sourceStage: "stage_8_a";
  readonly requestedBy: "operator" | "system";
  readonly unitKind: RuntimeExecutionUnitKind;
  readonly commandPreview: string;
  readonly payloadPreview: string;
  readonly createdAtIso: string;
  readonly approvedForMockRun: boolean;
  readonly actualExecutionRequested: false;
}

export interface RuntimeExecutionRecord {
  readonly executionId: string;
  readonly requestId: string;
  readonly projectId: string;
  readonly status: RuntimeExecutionStatus;
  readonly statusHistory: readonly RuntimeExecutionStatus[];
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly inMemoryOnly: true;
  readonly persisted: false;
  readonly actualRunnerInvoked: false;
  readonly cursorGithubInvoked: false;
  readonly connectorGatewayInvoked: false;
  readonly dbWritten: false;
}

export interface RuntimeExecutionAuditEvent {
  readonly auditEventId: string;
  readonly executionId: string;
  readonly requestId: string;
  readonly eventType:
    | "runtime_request_created"
    | "runtime_request_validated"
    | "mock_runner_started"
    | "mock_runner_completed"
    | "mock_runner_failed"
    | "runtime_boundary_checked";
  readonly statusBefore?: RuntimeExecutionStatus;
  readonly statusAfter?: RuntimeExecutionStatus;
  readonly message: string;
  readonly createdAtIso: string;
  readonly inMemoryOnly: true;
}

export interface RuntimeExecutionVerticalSliceStore {
  readonly records: readonly RuntimeExecutionRecord[];
  readonly auditEvents: readonly RuntimeExecutionAuditEvent[];
}

export interface RuntimeExecutionMockRunnerResult {
  readonly executionId: string;
  readonly requestId: string;
  readonly status: RuntimeExecutionStatus;
  readonly success: boolean;
  readonly message: string;
  readonly actualRunnerInvoked: false;
  readonly externalSideEffect: false;
  readonly auditEvents: readonly RuntimeExecutionAuditEvent[];
}

export interface RuntimeExecutionVerticalSliceInput {
  readonly contractBundleClosure?: RuntimeContractBundleClosureInput;
  readonly request?: Partial<RuntimeExecutionRequest>;
  readonly operatorStage8ApprovalConfirmed?: boolean;
  readonly scopeBoundaryConfirmed?: boolean;
  readonly mockRunnerOnlyConfirmed?: boolean;
  readonly inMemoryOnlyConfirmed?: boolean;
  readonly noExternalSideEffectConfirmed?: boolean;
}

export interface RuntimeExecutionVerticalSliceReport {
  readonly mode: RuntimeExecutionVerticalSliceMode;
  readonly stage: RuntimeExecutionVerticalSliceStage;
  readonly decision: RuntimeExecutionVerticalSliceDecision;

  readonly sourceStage7Decision: string;
  readonly sourceStage8EntryReady: boolean;
  readonly sourceStage8EntryScope: readonly string[];
  readonly sourceStage8EntryOutOfScope: readonly string[];

  readonly verticalSliceVersion: "runtime_execution_vertical_slice_v1";
  readonly verticalSliceTitle: string;
  readonly verticalSliceSummary: string;
  readonly verticalSliceFingerprint: string;

  readonly rawActualExecutionRequested: boolean;
  readonly actualExecutionRequestBlocked: boolean;
  readonly chainExecuted: boolean;
  readonly chainSkippedReason: string;

  readonly inMemoryOnly: true;
  readonly mockRunnerOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualApiRouteAllowedInThisStep: false;
  readonly actualExecutionRunnerAllowedInThisStep: false;
  readonly actualDryRunRunnerAllowedInThisStep: false;
  readonly actualCursorGithubCallAllowedInThisStep: false;
  readonly actualConnectorGatewayCallAllowedInThisStep: false;
  readonly actualDbWriteAllowedInThisStep: false;
  readonly actualSchemaMigrationAllowedInThisStep: false;
  readonly actualUiAllowedInThisStep: false;

  readonly request: RuntimeExecutionRequest;
  readonly initialRecord: RuntimeExecutionRecord;
  readonly finalRecord: RuntimeExecutionRecord;
  readonly store: RuntimeExecutionVerticalSliceStore;
  readonly mockRunnerResult: RuntimeExecutionMockRunnerResult;

  readonly requiredConfirmations: readonly string[];
  readonly checklist: readonly RuntimeExecutionVerticalSliceChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionVerticalSliceChecklistItem[];
  readonly findings: readonly RuntimeExecutionVerticalSliceFinding[];

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}
