/**
 * Read-only Connector Gateway experiment branch execution package (no git/flag/routing execution).
 */

export type ConnectorGatewayExperimentBranchExecutionPackageDecision =
  | "ready_for_manual_execution_after_approval"
  | "defer"
  | "blocked";

export interface ConnectorGatewayExperimentBranchExecutionCommand {
  readonly command: string;
  readonly purpose: string;
  readonly sequence: number;
  readonly mustRunManually: true;
  readonly requiresExplicitUserApproval: true;
  readonly caution: string;
}

export interface ConnectorGatewayExperimentBranchExecutionPackageFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayExperimentBranchExecutionPackageReport {
  readonly mode: "read_only_connector_gateway_branch_execution_package";
  readonly decision: ConnectorGatewayExperimentBranchExecutionPackageDecision;

  readonly sourceReadinessDecision: string;
  readonly recommendedBranchName: string;
  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";

  readonly manualCommands: readonly ConnectorGatewayExperimentBranchExecutionCommand[];
  readonly preflightChecklist: readonly string[];
  readonly regressionChecklist: readonly string[];
  readonly rollbackCriteria: readonly string[];

  readonly executesCommandsInThisStep: false;
  readonly createsBranchInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly changesRoutingInThisStep: false;

  readonly findings: readonly ConnectorGatewayExperimentBranchExecutionPackageFinding[];
}
