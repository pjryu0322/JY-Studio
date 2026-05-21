/**
 * Read-only controlled execution path candidate (no execution path/routing/connector/runtime/DB/git changes).
 */

export type ControlledExecutionPathCandidateDecision =
  | "ready_for_execution_path_review"
  | "defer"
  | "blocked";

export type ControlledExecutionPathCandidateMode = "observe_only" | "shadow_compare" | "controlled_candidate";

export interface ControlledExecutionPathCandidate {
  readonly sequence: number;
  readonly candidateId: string;
  readonly sourceRouteName: string;
  readonly proposedExecutionPath: string;
  readonly currentExecutionPath: string;
  readonly connectorId: string;
  readonly mode: ControlledExecutionPathCandidateMode;
  readonly executesInThisStep: false;
  readonly changesExecutionPathInThisStep: false;
  readonly changesRoutingInThisStep: false;
  readonly reason: string;
}

export interface ControlledExecutionPathCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ControlledExecutionPathCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ControlledExecutionPathCandidateReport {
  readonly mode: "read_only_controlled_execution_path_candidate";
  readonly stage: "stage_4_d";
  readonly decision: ControlledExecutionPathCandidateDecision;

  readonly sourceShadowRoutingDecision: string;
  readonly sourceFeatureFlagName: string;
  readonly sourceFeatureFlagDefault: "off";
  readonly sourceRouteCandidateCount: number;
  readonly sourceRouteCandidateSatisfiedCount: number;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly sourceFindingCodes: readonly string[];

  readonly sourceShadowRoutingFindingCodes: readonly string[];
  readonly sourceShadowRoutingNoRunChecklistCount: number;
  readonly sourceShadowRoutingNoRunChecklistSatisfiedCount: number;
  readonly sourceShadowRoutingRouteCandidateCount: number;
  readonly sourceShadowRoutingRouteCandidateSatisfiedCount: number;

  readonly executionPathCandidates: readonly ControlledExecutionPathCandidate[];
  readonly executionPathCandidateCount: number;
  readonly executionPathCandidateSatisfiedCount: number;

  readonly executionPathReviewConfirmed: boolean;
  readonly shadowRoutingReviewConfirmedForExecutionPath: boolean;
  readonly rollbackReviewConfirmedForExecutionPath: boolean;
  readonly featureFlagPlanConfirmedForExecutionPath: boolean;

  readonly candidateChecklist: readonly ControlledExecutionPathCandidateChecklistItem[];
  readonly safetyChecklist: readonly ControlledExecutionPathCandidateChecklistItem[];
  readonly rollbackChecklist: readonly ControlledExecutionPathCandidateChecklistItem[];
  readonly handoffChecklist: readonly ControlledExecutionPathCandidateChecklistItem[];
  readonly noRunChecklist: readonly ControlledExecutionPathCandidateChecklistItem[];
  readonly noRunChecklistCount: number;
  readonly noRunChecklistSatisfiedCount: number;

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

  readonly findings: readonly ControlledExecutionPathCandidateFinding[];
}
