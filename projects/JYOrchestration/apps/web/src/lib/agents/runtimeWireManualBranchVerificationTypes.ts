/**
 * Read-only manual branch creation verification (no branch/git/test/GitHub/PR execution).
 */

import type { RuntimeWireExperimentBranchPlanSourceNoRunFlags } from "@/lib/agents/runtimeWireExperimentBranchPlanTypes";

export type RuntimeWireManualBranchVerificationDecision =
  | "manual_branch_verified"
  | "defer"
  | "blocked";

export interface RuntimeWireManualBranchVerificationRegressionResult {
  readonly suite: string;
  readonly passed: boolean;
  readonly summary: string;
}

export interface RuntimeWireManualBranchVerificationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeWireManualBranchVerificationFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeWireManualBranchVerificationReport {
  readonly mode: "read_only_runtime_wire_manual_branch_verification";
  readonly stage: "stage_4_b";
  readonly decision: RuntimeWireManualBranchVerificationDecision;

  readonly sourceBranchPlanDecision: string;
  readonly sourcePlanFingerprint: string;
  readonly expectedBranchName: string;
  readonly actualBranchName: string;
  readonly branchMatches: boolean;

  readonly sourceRecommendedBranchName: string;
  readonly sourceRecommendedFeatureFlagName: string;
  readonly sourceManualCommandCount: number;
  readonly sourceRegressionSuiteCount: number;
  readonly sourceBranchPlanFindingCodes: readonly string[];
  readonly sourceBranchPlanNoRunFlags: RuntimeWireExperimentBranchPlanSourceNoRunFlags;

  readonly explicitManualExecutionConfirmed: boolean;
  readonly regressionResultsProvided: boolean;
  readonly regressionPassed: boolean;
  readonly rollbackRequired: boolean;

  readonly sanitizedRegressionResults: readonly RuntimeWireManualBranchVerificationRegressionResult[];

  readonly verificationChecklist: readonly RuntimeWireManualBranchVerificationChecklistItem[];
  readonly regressionChecklist: readonly RuntimeWireManualBranchVerificationChecklistItem[];
  readonly rollbackChecklist: readonly RuntimeWireManualBranchVerificationChecklistItem[];
  readonly noRunChecklist: readonly RuntimeWireManualBranchVerificationChecklistItem[];

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

  readonly findings: readonly RuntimeWireManualBranchVerificationFinding[];
}
