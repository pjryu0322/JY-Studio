/**
 * Read-only runtime execution handoff candidate (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type RuntimeExecutionHandoffCandidateDecision =
  | "ready_for_runtime_execution_handoff_design"
  | "defer"
  | "blocked";

export interface RuntimeExecutionHandoffCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionHandoffCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionHandoffCandidateReport {
  readonly mode: "read_only_runtime_execution_handoff_candidate";
  readonly decision: RuntimeExecutionHandoffCandidateDecision;

  readonly sourceStage2Decision: string;
  readonly sourceStage2Scope: string;
  readonly sourceStage2ClosureSummary: string;
  readonly sourceStage2NoRunPolicySatisfied: boolean;
  readonly sourceStage2ExitCriteriaSatisfied: boolean;
  readonly sourceStage2HandoffReady: boolean;
  readonly sourceStage2RecommendedNextPhases: readonly string[];
  readonly sourceStage2AggregatedBlockingFindingCodes: readonly string[];
  readonly sourceStage2NoRunBlocking: boolean;
  readonly sourceStage2PrerequisiteDeferred: boolean;

  readonly requiresSchemaPrBeforeRuntime: boolean;
  readonly requiresOperatorAuditSchemaPrBeforeRuntime: boolean;
  readonly requiresConnectorExperimentBranchBeforeRuntime: boolean;
  readonly requiresRuntimeExecutionWireDesignBeforeRuntime: boolean;
  readonly requiresFeatureFlagWireBeforeRuntime: boolean;

  readonly runtimeHandoffChecklist: readonly RuntimeExecutionHandoffCandidateChecklistItem[];
  readonly preExecutionSafetyChecklist: readonly RuntimeExecutionHandoffCandidateChecklistItem[];
  readonly prerequisitePolicyChecklist: readonly RuntimeExecutionHandoffCandidateChecklistItem[];
  readonly prerequisiteApprovalChecklist: readonly RuntimeExecutionHandoffCandidateChecklistItem[];
  readonly prerequisiteChecklist: readonly RuntimeExecutionHandoffCandidateChecklistItem[];

  readonly evaluatesHandoffOnly: true;
  readonly executesRuntimeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly RuntimeExecutionHandoffCandidateFinding[];
}
