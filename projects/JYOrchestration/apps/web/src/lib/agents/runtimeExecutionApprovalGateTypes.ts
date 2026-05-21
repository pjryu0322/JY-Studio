/**
 * Read-only runtime execution approval gate (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type RuntimeExecutionApprovalGateDecision =
  | "ready_for_controlled_runtime_wire_candidate"
  | "defer"
  | "blocked";

export interface RuntimeExecutionApprovalGateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionApprovalGateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionApprovalGateReport {
  readonly mode: "read_only_runtime_execution_approval_gate";
  readonly stage: "stage_3_b";
  readonly decision: RuntimeExecutionApprovalGateDecision;

  readonly gateVersion: 1;
  readonly gateTitle: string;
  readonly gateSummary: string;
  readonly gateFingerprint: string;

  readonly sourcePackageDecision: string;
  readonly sourcePlanDecision: string;
  readonly sourceHandoffDecision: string;
  readonly sourceStage2Decision: string;
  readonly sourcePlanFingerprint: string;
  readonly sourceApprovalReadinessReadyCount: number;
  readonly sourceApprovalReadinessTotalCount: number;
  readonly sourceApprovalReadinessMissing: readonly string[];
  readonly sourceApprovalReadinessComplete: boolean;

  readonly operatorFinalApprovalConfirmed: boolean;
  readonly riskAcknowledgementConfirmed: boolean;
  readonly rollbackAcknowledgementConfirmed: boolean;
  readonly executionWindowConfirmed: boolean;

  readonly approvalGateChecklist: readonly RuntimeExecutionApprovalGateChecklistItem[];
  readonly riskChecklist: readonly RuntimeExecutionApprovalGateChecklistItem[];
  readonly noRunChecklist: readonly RuntimeExecutionApprovalGateChecklistItem[];
  readonly handoffChecklist: readonly RuntimeExecutionApprovalGateChecklistItem[];

  readonly evaluatesApprovalOnly: true;
  readonly executesRuntimeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly RuntimeExecutionApprovalGateFinding[];
}
