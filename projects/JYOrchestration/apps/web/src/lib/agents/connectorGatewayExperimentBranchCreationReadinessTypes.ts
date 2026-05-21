/**
 * Read-only Connector Gateway experiment branch creation readiness (no git/flag/routing execution).
 */

export type ConnectorGatewayExperimentBranchCreationReadinessDecision =
  | "ready_for_explicit_user_approval"
  | "defer"
  | "blocked";

export interface ConnectorGatewayExperimentBranchCreationCommandCandidate {
  readonly command: string;
  readonly purpose: string;
  readonly allowedAfterExplicitApproval: boolean;
  readonly caution: string;
}

export interface ConnectorGatewayExperimentBranchCreationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ConnectorGatewayExperimentBranchCreationReadinessFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ConnectorGatewayExperimentBranchCreationReadinessReport {
  readonly mode: "read_only_connector_gateway_branch_creation_readiness";
  readonly decision: ConnectorGatewayExperimentBranchCreationReadinessDecision;

  readonly sourceApprovalDecision: string;
  readonly sourceScope: string;
  readonly sourceCandidateBoundaries: readonly string[];
  readonly sourceCandidateConnectorIds: readonly string[];
  readonly sourceCandidateBoundaryKinds: readonly string[];
  readonly sourceBranchPlanDecision: string;
  readonly sourceRoutingDecision: string;
  readonly sourceRoutingScope: string;

  readonly recommendedBranchName: string;
  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";

  readonly commandCandidates: readonly ConnectorGatewayExperimentBranchCreationCommandCandidate[];
  readonly approvalChecklist: readonly ConnectorGatewayExperimentBranchCreationChecklistItem[];
  readonly regressionChecklist: readonly string[];
  readonly rollbackCriteria: readonly string[];

  readonly requiresExplicitUserApproval: boolean;
  readonly createsBranchInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly changesRoutingInThisStep: false;

  readonly findings: readonly ConnectorGatewayExperimentBranchCreationReadinessFinding[];
}
