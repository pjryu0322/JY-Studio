/**
 * Read-only Stage 4 integrated closure verdict (no runtime/routing/execution path/DB/git changes).
 */

export type Stage4IntegratedClosureVerdictDecision = "stage4_closure_ready" | "defer" | "blocked";

export interface Stage4IntegratedClosureChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface Stage4IntegratedClosureFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface Stage4IntegratedClosureVerdictReport {
  readonly mode: "read_only_stage4_integrated_closure_verdict";
  readonly stage: "stage_4_f";
  readonly decision: Stage4IntegratedClosureVerdictDecision;

  readonly sourceReviewPackageDecision: string;
  readonly sourceReviewPackageFingerprint: string;
  readonly sourceReviewPackageSummary: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly sourceFindingCodes: readonly string[];

  readonly closureVersion: "stage_4_f_v1";
  readonly closureTitle: string;
  readonly closureSummary: string;
  readonly closureFingerprint: string;

  readonly stage4ReadOnlyScopeConfirmed: boolean;
  readonly stage4NoRuntimeExecutionConfirmed: boolean;
  readonly stage4NoRoutingChangeConfirmed: boolean;
  readonly stage4NoDbSchemaChangeConfirmed: boolean;
  readonly stage4HandoffPlanConfirmed: boolean;

  readonly closureChecklist: readonly Stage4IntegratedClosureChecklistItem[];
  readonly noRunChecklist: readonly Stage4IntegratedClosureChecklistItem[];
  readonly handoffChecklist: readonly Stage4IntegratedClosureChecklistItem[];
  readonly riskChecklist: readonly Stage4IntegratedClosureChecklistItem[];

  readonly noRunChecklistCount: number;
  readonly noRunChecklistSatisfiedCount: number;

  readonly recommendedNextActions: readonly string[];
  readonly separatedWorkItems: readonly string[];

  readonly closureIsRuntimeExecutionPermission: false;
  readonly requiresStage5RuntimeDesign: boolean;
  readonly requiresSeparateSchemaPr: boolean;
  readonly requiresSeparateOperatorAuditSchemaPr: boolean;
  readonly requiresSeparateConnectorExperimentBranch: boolean;
  readonly requiresSeparateFeatureFlagWire: boolean;
  readonly requiresSeparateRuntimeWritePathWire: boolean;
  /** Primary recommended Stage 5 entry candidate when closure is ready (not an execution order). */
  readonly stage5Candidate:
    | "role_knowledge_binding_foundation"
    | "runtime_execution_design"
    | "continue_read_only_hardening";
  /** All Stage 5 entry candidates defined at Stage 4-F closure (read-only planning only). */
  readonly stage5EntryCandidates: readonly (
    | "role_knowledge_binding_foundation"
    | "runtime_execution_design"
    | "continue_read_only_hardening"
  )[];

  readonly executesRuntimeInThisStep: false;
  readonly changesExecutionPathInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly callsConnectorInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly createsBranchInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;

  readonly findings: readonly Stage4IntegratedClosureFinding[];
}
