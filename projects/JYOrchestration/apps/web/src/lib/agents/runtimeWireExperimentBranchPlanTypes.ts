/**
 * Read-only runtime wire experiment branch plan (no branch/git/PR/routing/write/DB execution).
 */

export type RuntimeWireExperimentBranchPlanDecision =
  | "ready_for_manual_branch_creation_approval"
  | "defer"
  | "blocked";

export interface RuntimeWireExperimentBranchManualCommand {
  readonly sequence: number;
  readonly command: string;
  readonly caution: string;
  readonly executesInThisStep: false;
}

export interface RuntimeWireExperimentBranchPlanChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeWireExperimentBranchPlanFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeWireExperimentBranchPlanReport {
  readonly mode: "read_only_runtime_wire_experiment_branch_plan";
  readonly stage: "stage_4_a";
  readonly decision: RuntimeWireExperimentBranchPlanDecision;

  readonly sourceWireCandidateDecision: string;
  readonly sourceApprovalGateDecision: string;
  readonly sourceApprovalGateFingerprint: string;
  readonly sourceCandidateFingerprint: string;

  readonly planVersion: 1;
  readonly planTitle: string;
  readonly planSummary: string;
  readonly planFingerprint: string;

  readonly recommendedBranchName: string;
  readonly recommendedFeatureFlagName: string;
  readonly manualCommandCandidates: readonly RuntimeWireExperimentBranchManualCommand[];
  readonly regressionSuites: readonly string[];

  readonly branchSafetyChecklist: readonly RuntimeWireExperimentBranchPlanChecklistItem[];
  readonly rollbackChecklist: readonly RuntimeWireExperimentBranchPlanChecklistItem[];
  readonly handoffChecklist: readonly RuntimeWireExperimentBranchPlanChecklistItem[];

  readonly createsBranchInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly executesRuntimeInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly RuntimeWireExperimentBranchPlanFinding[];
}
