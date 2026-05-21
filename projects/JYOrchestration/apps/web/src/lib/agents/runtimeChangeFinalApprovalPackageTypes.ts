/**
 * Read-only runtime change final approval package (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type RuntimeChangeFinalApprovalPackageDecision =
  | "ready_for_final_runtime_change_approval"
  | "defer"
  | "blocked";

export interface RuntimeChangeFinalApprovalPackageChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeChangeFinalApprovalPackageFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeChangeFinalApprovalPackageReport {
  readonly mode: "read_only_runtime_change_final_approval_package";
  readonly decision: RuntimeChangeFinalApprovalPackageDecision;

  readonly sourceRoutingShadowDecision: string;
  readonly sourceRoutingShadowRouteMode: string;
  readonly sourceRoutingShadowBoundaryIds: readonly string[];
  readonly sourceRoutingShadowConnectorIds: readonly string[];
  readonly sourceRoutingShadowBoundarySource: string;
  readonly sourceRoutingShadowConnectorSource: string;
  readonly sourceRoutingShadowRequiresStage1Regression: boolean;
  readonly sourceRoutingShadowRequiresRollbackPlan: boolean;
  readonly sourceRoutingShadowBlockingFindingCodes: readonly string[];

  readonly sourceWireCandidateDecision: string;
  readonly sourceWireCandidateAgentWireGateDecision: string;
  readonly sourceWireCandidateOperatorWireGateDecision: string;
  readonly sourceWireCandidateSchemaMigrationDecision: string;
  readonly sourceWireCandidateBlockingFindingCodes: readonly string[];

  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;

  readonly finalApprovalChecklist: readonly RuntimeChangeFinalApprovalPackageChecklistItem[];
  readonly runtimeSafetyChecklist: readonly RuntimeChangeFinalApprovalPackageChecklistItem[];
  readonly rollbackChecklist: readonly RuntimeChangeFinalApprovalPackageChecklistItem[];
  readonly operatorChecklist: readonly RuntimeChangeFinalApprovalPackageChecklistItem[];

  readonly packagesApprovalOnly: true;
  readonly changesRuntimeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresAdapterInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly RuntimeChangeFinalApprovalPackageFinding[];
}
