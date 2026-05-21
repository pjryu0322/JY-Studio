/**
 * Read-only runtime execution plan package (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type RuntimeExecutionPlanPackageDecision =
  | "ready_for_runtime_execution_approval_gate"
  | "defer"
  | "blocked";

export type RuntimeExecutionDryRunCandidateStatus =
  | "dry_run_ready"
  | "dry_run_deferred"
  | "dry_run_blocked";

export interface RuntimeExecutionPlanPackageChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionPlanPackageFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionDryRunCandidate {
  readonly status: RuntimeExecutionDryRunCandidateStatus;
  readonly sourcePlanDecision: string;
  readonly simulatedOnly: true;
  readonly executesRuntimeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsExternalConnectorInThisStep: false;
  readonly candidateSteps: readonly string[];
  readonly blockedReasons: readonly string[];
  readonly deferredReasons: readonly string[];
}

export interface RuntimeExecutionApprovalReadiness {
  readonly operatorApprovalReady: boolean;
  readonly rollbackReviewReady: boolean;
  readonly stage1RegressionReady: boolean;
  readonly schemaPrerequisitesReady: boolean;
  readonly connectorExperimentReady: boolean;
  readonly featureFlagWireReady: boolean;
  readonly runtimeWireDesignReady: boolean;
  readonly readyCount: number;
  readonly totalCount: 7;
  readonly missing: readonly string[];
}

export interface RuntimeExecutionPlanPackageReport {
  readonly mode: "read_only_runtime_execution_plan_package";
  readonly stage: "stage_3_a";
  readonly decision: RuntimeExecutionPlanPackageDecision;

  readonly sourcePlanDecision: string;
  readonly sourceHandoffDecision: string;
  readonly sourceStage2Decision: string;
  readonly sourcePlanFingerprint: string;
  readonly sourcePlanStepCount: number;
  readonly sourceSatisfiedPlanStepCount: number;

  readonly packageVersion: 1;
  readonly packageTitle: string;
  readonly packageSummary: string;

  readonly dryRunCandidate: RuntimeExecutionDryRunCandidate;
  readonly approvalReadiness: RuntimeExecutionApprovalReadiness;

  readonly executionPlanChecklist: readonly RuntimeExecutionPlanPackageChecklistItem[];
  readonly dryRunChecklist: readonly RuntimeExecutionPlanPackageChecklistItem[];
  readonly approvalChecklist: readonly RuntimeExecutionPlanPackageChecklistItem[];
  readonly safetyChecklist: readonly RuntimeExecutionPlanPackageChecklistItem[];

  readonly buildsPackageOnly: true;
  readonly executesPlanInThisStep: false;
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

  readonly findings: readonly RuntimeExecutionPlanPackageFinding[];
}
