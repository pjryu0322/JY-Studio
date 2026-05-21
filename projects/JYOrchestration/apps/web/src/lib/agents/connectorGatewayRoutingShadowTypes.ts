/**
 * Read-only Connector Gateway routing shadow (no runtime route change, connector, or flag wire).
 */

export type ConnectorGatewayRoutingShadowDecision = "shadow_ready" | "defer" | "blocked";

export type ConnectorGatewayRoutingShadowRouteMode =
  | "observe_only"
  | "shadow_compare"
  | "fallback_required";

export type ConnectorGatewayRoutingShadowBoundarySource = "explicit" | "default" | "missing";

export type ConnectorGatewayRoutingShadowConnectorSource =
  | "explicit"
  | "routing_experiment"
  | "missing";

export interface ConnectorGatewayRoutingShadowRequest {
  readonly target?: string;
  readonly boundaryIds?: readonly string[];
  readonly connectorIds?: readonly string[];
  readonly featureFlagEnabled?: boolean;
  readonly explicitShadowApproval?: boolean;
  readonly actualRuntimePath?: string;
}

export interface ConnectorGatewayRoutingShadowChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ConnectorGatewayRoutingShadowFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayRoutingShadowReport {
  readonly mode: "read_only_connector_gateway_routing_shadow";
  readonly decision: ConnectorGatewayRoutingShadowDecision;
  readonly routeMode: ConnectorGatewayRoutingShadowRouteMode;

  readonly target: string;
  readonly boundaryIds: readonly string[];
  readonly boundarySource: ConnectorGatewayRoutingShadowBoundarySource;
  readonly connectorIds: readonly string[];
  readonly connectorSource: ConnectorGatewayRoutingShadowConnectorSource;

  readonly sourceRoutingDecision: string;
  readonly sourceRoutingScope: string;
  readonly sourceRoutingRequiresStage1Regression: boolean;
  readonly sourceBranchManualVerificationDecision: string;
  readonly sourceBranchManualVerificationRollbackRequired: boolean;
  readonly sourceManualVerificationUsesExternalResults: false;
  readonly sourceManualVerificationActualBranchProvided: false;
  readonly sourceManualVerificationRegressionResultsProvided: false;

  readonly featureFlagEnabled: boolean;
  readonly explicitShadowApproval: boolean;
  readonly actualRuntimePath: string;
  readonly shadowRuntimePath: string;

  readonly routeChecklist: readonly ConnectorGatewayRoutingShadowChecklistItem[];
  readonly safetyChecklist: readonly ConnectorGatewayRoutingShadowChecklistItem[];
  readonly rollbackChecklist: readonly ConnectorGatewayRoutingShadowChecklistItem[];

  readonly observesOnly: true;
  readonly changesRuntimeRouteInThisStep: false;
  readonly callsConnectorInThisStep: false;
  readonly invokesCursorInThisStep: false;
  readonly invokesGithubInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;

  readonly findings: readonly ConnectorGatewayRoutingShadowFinding[];
}
