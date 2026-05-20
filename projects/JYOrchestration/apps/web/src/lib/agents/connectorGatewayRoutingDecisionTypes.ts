/**
 * Read-only Connector Gateway routing transition decision (no execution path changes).
 */

export type ConnectorGatewayRoutingDecision = "ready_for_design" | "defer" | "blocked";

export type ConnectorGatewayRoutingTarget =
  | "cursor_execution"
  | "github_pr"
  | "github_branch"
  | "github_merge"
  | "github_status";

export interface ConnectorGatewayRoutingFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayRoutingDecisionReport {
  readonly mode: "read_only_routing_decision";
  readonly decision: ConnectorGatewayRoutingDecision;
  readonly target: ConnectorGatewayRoutingTarget;
  readonly connectorId: string;
  readonly requiresExecutionPathChange: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresStage1Regression: boolean;
  readonly findings: readonly ConnectorGatewayRoutingFinding[];
}
