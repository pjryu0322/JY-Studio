/**
 * Read-only Connector Gateway routing experiment branch design (no routing wire).
 */

export type ConnectorGatewayRoutingExperimentDecision =
  | "ready_for_experiment_design"
  | "defer"
  | "blocked";

export type ConnectorGatewayRoutingExperimentScope =
  | "cursor_only"
  | "github_only"
  | "cursor_and_github"
  | "none";

export interface ConnectorGatewayRoutingExperimentFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayRoutingExperimentReport {
  readonly mode: "read_only_routing_experiment_design";
  readonly decision: ConnectorGatewayRoutingExperimentDecision;
  readonly scope: ConnectorGatewayRoutingExperimentScope;
  readonly experimentBranchRequired: boolean;
  readonly featureFlagRequired: boolean;
  readonly featureFlagDefault: "off";
  readonly directCallFallbackRequired: boolean;
  readonly stage1RegressionRequired: boolean;
  readonly rollbackPlanRequired: boolean;
  readonly findings: readonly ConnectorGatewayRoutingExperimentFinding[];
}
