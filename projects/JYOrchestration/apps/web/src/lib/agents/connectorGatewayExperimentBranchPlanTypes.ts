/**
 * Read-only Connector Gateway experiment branch plan (no branch creation or routing wire).
 */

export type ConnectorGatewayExperimentBranchPlanDecision =
  | "ready_for_branch_plan"
  | "defer"
  | "blocked";

export type ConnectorGatewayExperimentBranchPlanScope =
  | "cursor_only"
  | "github_only"
  | "cursor_and_github"
  | "none";

export interface ConnectorGatewayExperimentBranchPlanFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayExperimentBranchPlanReport {
  readonly mode: "read_only_connector_gateway_experiment_branch_plan";
  readonly decision: ConnectorGatewayExperimentBranchPlanDecision;
  readonly scope: ConnectorGatewayExperimentBranchPlanScope;
  readonly recommendedBranchName: string;
  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";
  readonly requiresDirectCallFallback: boolean;
  readonly requiresStage1Regression: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly candidateBoundaries: readonly string[];
  readonly candidateConnectorIds: readonly string[];
  readonly candidateBoundaryKinds: readonly string[];
  readonly sourceRoutingDecision: string;
  readonly sourceRoutingScope: string;
  readonly requiredRegressionSuites: readonly string[];
  readonly validationSuites: readonly string[];
  readonly rollbackCriteria: readonly string[];
  readonly findings: readonly ConnectorGatewayExperimentBranchPlanFinding[];
}
