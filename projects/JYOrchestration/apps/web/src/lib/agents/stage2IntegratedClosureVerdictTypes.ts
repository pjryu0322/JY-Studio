/**
 * Read-only Stage 2 integrated closure verdict (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type Stage2IntegratedClosureVerdictDecision = "stage2_closure_ready" | "defer" | "blocked";

export type Stage2NextPhaseRecommendation =
  | "prepare_schema_migration_pr"
  | "prepare_operator_audit_schema_pr"
  | "prepare_connector_gateway_experiment_branch"
  | "prepare_runtime_execution_wire_design"
  | "continue_read_only_hardening";

export type Stage2Stage3Candidate =
  | "runtime_execution_handoff_design"
  | "schema_pr_preparation"
  | "connector_gateway_experiment";

export interface Stage2IntegratedClosureVerdictChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface Stage2IntegratedClosureVerdictFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface Stage2IntegratedClosureVerdictReport {
  readonly mode: "read_only_stage2_integrated_closure_verdict";
  readonly decision: Stage2IntegratedClosureVerdictDecision;

  readonly stage2Scope: "read_only_multi_agent_runtime_foundation";
  readonly stage2ClosureSummary: string;

  readonly actualRuntimeChangeAllowedAfterStage2: false;
  readonly requiresSeparateSchemaPr: boolean;
  readonly requiresSeparateOperatorAuditSchemaPr: boolean;
  readonly requiresSeparateConnectorExperimentBranch: boolean;
  readonly requiresSeparateRuntimeExecutionWireDesign: boolean;
  readonly requiresSeparateFeatureFlagWire: boolean;

  readonly stage3Candidate: Stage2Stage3Candidate;
  readonly stage2ExitCriteriaSatisfied: boolean;
  readonly stage2NoRunPolicySatisfied: boolean;
  readonly stage2HandoffReady: boolean;

  readonly sourceRuntimeFinalApprovalDecision: string;
  readonly sourceWireCandidateDecision: string;
  readonly sourceRoutingShadowDecision: string;
  readonly sourceSchemaMigrationReadinessDecision: string;

  readonly sourceRuntimeFinalApprovalConfirmed: boolean;
  readonly sourceRoutingShadowReviewConfirmed: boolean;
  readonly sourceWireCandidateReviewConfirmed: boolean;
  readonly sourceStage1RegressionReviewConfirmed: boolean;
  readonly sourceRollbackPlanReviewConfirmed: boolean;
  readonly sourceOperatorAuditReviewConfirmed: boolean;

  readonly sourceRuntimeBlockingFindingCodes: readonly string[];
  readonly sourceWireCandidateBlockingFindingCodes: readonly string[];
  readonly sourceRoutingShadowBlockingFindingCodes: readonly string[];

  readonly closureChecklist: readonly Stage2IntegratedClosureVerdictChecklistItem[];
  readonly noRunChecklist: readonly Stage2IntegratedClosureVerdictChecklistItem[];
  readonly handoffChecklist: readonly Stage2IntegratedClosureVerdictChecklistItem[];
  readonly riskChecklist: readonly Stage2IntegratedClosureVerdictChecklistItem[];

  readonly recommendedNextPhases: readonly Stage2NextPhaseRecommendation[];

  readonly closesStage2Only: true;
  readonly executesRuntimeChangeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresAdapterInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly Stage2IntegratedClosureVerdictFinding[];
}
