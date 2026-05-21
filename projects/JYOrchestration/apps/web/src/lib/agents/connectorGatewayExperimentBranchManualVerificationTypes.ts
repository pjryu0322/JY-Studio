/**
 * Read-only Connector Gateway experiment branch manual verification (no git/test/flag/routing execution).
 */

export type ConnectorGatewayExperimentBranchManualVerificationDecision =
  | "manual_branch_verified"
  | "defer"
  | "blocked";

export interface ConnectorGatewayExperimentBranchManualVerificationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ConnectorGatewayExperimentBranchManualVerificationFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayExperimentBranchRegressionResult {
  readonly suite: string;
  readonly passed: boolean;
  readonly summary: string;
}

export interface ConnectorGatewayExperimentBranchManualVerificationReport {
  readonly mode: "read_only_connector_gateway_branch_manual_verification";
  readonly decision: ConnectorGatewayExperimentBranchManualVerificationDecision;

  readonly sourceExecutionPackageDecision: string;
  readonly expectedBranchName: string;
  readonly actualBranchName: string;
  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";

  readonly explicitManualExecutionConfirmed: boolean;
  readonly currentBranchMatchesExpected: boolean;
  readonly regressionPassed: boolean;
  readonly rollbackRequired: boolean;

  readonly verificationChecklist: readonly ConnectorGatewayExperimentBranchManualVerificationChecklistItem[];
  readonly regressionResults: readonly ConnectorGatewayExperimentBranchRegressionResult[];
  readonly rollbackCriteria: readonly string[];

  readonly executesGitInThisStep: false;
  readonly createsBranchInThisStep: false;
  readonly runsTestsInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly changesRoutingInThisStep: false;

  readonly findings: readonly ConnectorGatewayExperimentBranchManualVerificationFinding[];
}
