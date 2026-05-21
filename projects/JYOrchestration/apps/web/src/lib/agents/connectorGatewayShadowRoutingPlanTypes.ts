/**
 * Read-only Connector Gateway shadow routing plan (no routing/connector/Cursor/GitHub/runtime execution).
 */

export type ConnectorGatewayShadowRoutingPlanDecision =
  | "ready_for_shadow_routing_review"
  | "defer"
  | "blocked";

export type ConnectorGatewayShadowRoutingMode = "observe_only" | "shadow_compare";

export interface ConnectorGatewayShadowRouteCandidate {
  readonly sequence: number;
  readonly routeName: string;
  readonly sourcePath: string;
  readonly shadowPath: string;
  readonly connectorId: string;
  readonly mode: ConnectorGatewayShadowRoutingMode;
  readonly executesInThisStep: false;
  readonly changesRoutingInThisStep: false;
  readonly reason: string;
}

export interface ConnectorGatewayShadowRoutingPlanChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ConnectorGatewayShadowRoutingPlanFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayShadowRoutingPlanReport {
  readonly mode: "read_only_connector_gateway_shadow_routing_plan";
  readonly stage: "stage_4_c";
  readonly decision: ConnectorGatewayShadowRoutingPlanDecision;

  readonly sourceManualBranchDecision: string;
  readonly sourceExpectedBranchName: string;
  readonly sourceActualBranchName: string;
  readonly sourceBranchMatches: boolean;
  readonly sourceRegressionPassed: boolean;
  readonly sourceRollbackRequired: boolean;
  readonly sourceFindingCodes: readonly string[];

  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";
  readonly featureFlagEnabledInThisStep: false;

  readonly shadowRouteCandidates: readonly ConnectorGatewayShadowRouteCandidate[];
  readonly routeCandidateCount: number;
  readonly routeCandidateSatisfiedCount: number;

  readonly shadowRoutingChecklist: readonly ConnectorGatewayShadowRoutingPlanChecklistItem[];
  readonly safetyChecklist: readonly ConnectorGatewayShadowRoutingPlanChecklistItem[];
  readonly rollbackChecklist: readonly ConnectorGatewayShadowRoutingPlanChecklistItem[];
  readonly noRunChecklist: readonly ConnectorGatewayShadowRoutingPlanChecklistItem[];

  readonly executesRuntimeInThisStep: false;
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

  readonly findings: readonly ConnectorGatewayShadowRoutingPlanFinding[];
}
