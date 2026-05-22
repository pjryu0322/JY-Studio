/**
 * Stage 9-B Stage 10 entry trace and report fields (read-only).
 */

import type { RuntimeExecutionApiMvpReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeExecutionMvpClosureDecisionInput } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export const STAGE10_ENTRY_CANDIDATE = "external_execution_adapter_design" as const;

export const STAGE10_ENTRY_MODE = "external_execution_adapter_boundary_design" as const;

export function mapRuntimeExecutionMvpClosureSourceTrace(
  source: RuntimeExecutionApiMvpReport,
): Pick<
  RuntimeExecutionMvpClosureDecisionInput,
  | "sourceStage9Decision"
  | "sourceStage9AClosureReady"
  | "sourceRouteHandlerCount"
  | "sourceServiceActionCount"
  | "sourceBoundaryReportIncludedInEveryResponse"
  | "sourceApprovalActionImplemented"
  | "sourceMockRunnerAdapterImplemented"
  | "sourceAuditQueryImplemented"
  | "sourceStatusQueryImplemented"
  | "sourceActualApiRouteImplementedInThisStep"
  | "sourceInMemoryStoreImplementedInThisStep"
  | "sourceMockRunnerAdapterImplementedInThisStep"
  | "sourceActualExternalExecutionAllowedInThisStep"
  | "sourceActualCursorGithubCallAllowedInThisStep"
  | "sourceActualConnectorGatewayCallAllowedInThisStep"
  | "sourceActualDbWriteAllowedInThisStep"
  | "sourceActualSchemaMigrationAllowedInThisStep"
  | "sourceActualUiImplementationAllowedInThisStep"
> {
  return {
    sourceStage9Decision: source.decision,
    sourceStage9AClosureReady: source.stage9AClosureReady,
    sourceRouteHandlerCount: source.routeHandlerCount,
    sourceServiceActionCount: source.serviceActionCount,
    sourceBoundaryReportIncludedInEveryResponse: source.boundaryReportIncludedInEveryResponse,
    sourceApprovalActionImplemented: source.approvalActionImplemented,
    sourceMockRunnerAdapterImplemented: source.mockRunnerAdapterImplemented,
    sourceAuditQueryImplemented: source.auditQueryImplemented,
    sourceStatusQueryImplemented: source.statusQueryImplemented,
    sourceActualApiRouteImplementedInThisStep: source.actualApiRouteImplementedInThisStep,
    sourceInMemoryStoreImplementedInThisStep: source.inMemoryStoreImplementedInThisStep,
    sourceMockRunnerAdapterImplementedInThisStep: source.mockRunnerAdapterImplementedInThisStep,
    sourceActualExternalExecutionAllowedInThisStep: source.actualExternalExecutionAllowedInThisStep,
    sourceActualCursorGithubCallAllowedInThisStep: source.actualCursorGithubCallAllowedInThisStep,
    sourceActualConnectorGatewayCallAllowedInThisStep: source.actualConnectorGatewayCallAllowedInThisStep,
    sourceActualDbWriteAllowedInThisStep: source.actualDbWriteAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualUiImplementationAllowedInThisStep: source.actualUiImplementationAllowedInThisStep,
  };
}

export function buildRuntimeExecutionMvpClosureStage10ReportFields(input: {
  readonly stage10EntryReady: boolean;
}) {
  return {
    stage10EntryCandidate: STAGE10_ENTRY_CANDIDATE,
    stage10EntryMode: STAGE10_ENTRY_MODE,
    stage10EntryReady: input.stage10EntryReady,
    stage10RequiresSeparateApproval: true as const,
    stage10ImplementationAllowedInThisStep: false as const,
    stage10AdapterBoundaryDesignAllowed: true as const,
    stage10CursorGithubBoundaryDesignAllowed: true as const,
    stage10ConnectorBoundaryDesignAllowed: true as const,
    stage10RunnerBoundaryDesignAllowed: true as const,
    stage10DryRunSimulationDesignAllowed: true as const,
    stage10RollbackBoundaryDesignAllowed: true as const,
    stage10ActualCursorExecutionAllowed: false as const,
    stage10ActualGithubWriteAllowed: false as const,
    stage10ActualConnectorGatewayCallAllowed: false as const,
    stage10ActualDbPersistenceAllowed: false as const,
    stage10ActualProductionRunnerAllowed: false as const,
    stage10ActualUiImplementationAllowed: false as const,
  };
}
