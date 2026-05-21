/**
 * Read-only runtime wire experiment review package (no runtime/routing/execution path/DB/git changes).
 */

export type RuntimeWireExperimentReviewPackageDecision =
  | "ready_for_stage4_closure_verdict"
  | "defer"
  | "blocked";

export interface RuntimeWireExperimentReviewChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeWireExperimentReviewFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeWireExperimentReviewPackageReport {
  readonly mode: "read_only_runtime_wire_experiment_review_package";
  readonly stage: "stage_4_e";
  readonly decision: RuntimeWireExperimentReviewPackageDecision;

  readonly sourceControlledExecutionPathDecision: string;
  readonly sourceExecutionPathCandidateCount: number;
  readonly sourceExecutionPathCandidateSatisfiedCount: number;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly sourceFindingCodes: readonly string[];

  readonly reviewPackageVersion: "stage_4_e_v1";
  readonly reviewPackageTitle: string;
  readonly reviewPackageSummary: string;
  readonly reviewFingerprint: string;

  readonly runtimeWireReviewConfirmed: boolean;
  readonly connectorGatewayReviewConfirmed: boolean;
  readonly executionPathReviewConfirmedForPackage: boolean;
  readonly featureFlagReviewConfirmedForPackage: boolean;
  readonly rollbackReviewConfirmedForPackage: boolean;
  readonly operatorFinalReviewConfirmed: boolean;

  readonly experimentReadinessChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];
  readonly connectorGatewayChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];
  readonly executionPathChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];
  readonly featureFlagChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];
  readonly rollbackChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];
  readonly noRunChecklist: readonly RuntimeWireExperimentReviewChecklistItem[];

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

  readonly findings: readonly RuntimeWireExperimentReviewFinding[];
}
