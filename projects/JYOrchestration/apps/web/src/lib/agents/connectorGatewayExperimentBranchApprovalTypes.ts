/**
 * Read-only Connector Gateway experiment branch approval readiness (no branch/flag/routing wire).
 */

export type ConnectorGatewayExperimentBranchApprovalDecision =
  | "ready_for_operator_approval"
  | "defer"
  | "blocked";

export type ConnectorGatewayExperimentBranchApprovalScope =
  | "cursor_only"
  | "github_only"
  | "cursor_and_github"
  | "none";

export interface ConnectorGatewayExperimentBranchApprovalChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ConnectorGatewayExperimentBranchApprovalFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayExperimentBranchApprovalReport {
  readonly mode: "read_only_connector_gateway_experiment_branch_approval";
  readonly decision: ConnectorGatewayExperimentBranchApprovalDecision;
  readonly scope: ConnectorGatewayExperimentBranchApprovalScope;

  readonly recommendedBranchName: string;
  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";

  readonly requiresOperatorApproval: boolean;
  readonly requiresRegressionChecklist: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresDirectCallFallback: boolean;
  readonly requiresStage1Regression: boolean;

  readonly approvalChecklist: readonly ConnectorGatewayExperimentBranchApprovalChecklistItem[];
  readonly requiredRegressionSuites: readonly string[];
  readonly validationSuites: readonly string[];
  readonly rollbackCriteria: readonly string[];

  readonly candidateBoundaries: readonly string[];
  readonly candidateConnectorIds: readonly string[];
  readonly candidateBoundaryKinds: readonly string[];
  readonly sourceBranchPlanDecision: string;
  readonly sourceRoutingDecision: string;
  readonly sourceRoutingScope: string;

  readonly findings: readonly ConnectorGatewayExperimentBranchApprovalFinding[];
}
