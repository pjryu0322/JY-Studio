/**
 * Read-only runtime execution plan builder (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type RuntimeExecutionPlanBuilderDecision =
  | "ready_for_runtime_execution_plan_review"
  | "defer"
  | "blocked";

export type RuntimeExecutionPlanStepKind =
  | "operator_approval"
  | "stage1_regression_check"
  | "schema_migration_pr_check"
  | "operator_audit_schema_pr_check"
  | "connector_experiment_branch_check"
  | "feature_flag_check"
  | "dry_run_execution_plan"
  | "rollback_plan_check"
  | "final_operator_confirmation";

export interface RuntimeExecutionPlanStepCandidate {
  readonly sequence: number;
  readonly kind: RuntimeExecutionPlanStepKind;
  readonly title: string;
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly reason: string;
  readonly executesInThisStep: false;
}

export interface RuntimeExecutionPlanBuilderChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionPlanBuilderFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionPlanBuilderReport {
  readonly mode: "read_only_runtime_execution_plan_builder";
  readonly decision: RuntimeExecutionPlanBuilderDecision;

  readonly sourceHandoffDecision: string;
  readonly sourceStage2Decision: string;
  readonly sourceStage2NoRunPolicySatisfied: boolean;
  readonly sourceStage2ExitCriteriaSatisfied: boolean;
  readonly sourceStage2HandoffReady: boolean;

  readonly planCandidateId: string;
  readonly planFingerprint: string;
  readonly planVersion: 1;
  readonly planTitle: string;
  readonly planSummary: string;

  readonly planSteps: readonly RuntimeExecutionPlanStepCandidate[];
  readonly planChecklist: readonly RuntimeExecutionPlanBuilderChecklistItem[];
  readonly noRunChecklist: readonly RuntimeExecutionPlanBuilderChecklistItem[];

  readonly buildsPlanOnly: true;
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

  readonly findings: readonly RuntimeExecutionPlanBuilderFinding[];
}
