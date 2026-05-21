/**
 * Read-only controlled runtime wire candidate (no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

export type ControlledRuntimeWireCandidateDecision =
  | "ready_for_runtime_wire_experiment_branch"
  | "defer"
  | "blocked";

export type ControlledRuntimeWireCandidateKind =
  | "agent_execution_record_write_path"
  | "operator_approval_audit_write_path"
  | "connector_gateway_shadow_routing"
  | "feature_flag_wire"
  | "runtime_execution_boundary";

export interface ControlledRuntimeWireCandidateItem {
  readonly sequence: number;
  readonly kind: ControlledRuntimeWireCandidateKind;
  readonly title: string;
  readonly target: string;
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly reason: string;
  readonly wiresInThisStep: false;
  readonly executesInThisStep: false;
}

export interface ControlledRuntimeWireCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface ControlledRuntimeWireCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface ControlledRuntimeWireCandidateReport {
  readonly mode: "read_only_controlled_runtime_wire_candidate";
  readonly stage: "stage_3_c";
  readonly decision: ControlledRuntimeWireCandidateDecision;

  readonly sourceApprovalGateDecision: string;
  readonly sourcePackageDecision: string;
  readonly sourcePlanDecision: string;
  readonly sourcePlanFingerprint: string;
  readonly sourceApprovalGateFingerprint: string;

  readonly candidateVersion: 1;
  readonly candidateTitle: string;
  readonly candidateSummary: string;
  readonly candidateFingerprint: string;

  readonly wireCandidates: readonly ControlledRuntimeWireCandidateItem[];
  readonly candidateChecklist: readonly ControlledRuntimeWireCandidateChecklistItem[];
  readonly safetyChecklist: readonly ControlledRuntimeWireCandidateChecklistItem[];
  readonly handoffChecklist: readonly ControlledRuntimeWireCandidateChecklistItem[];

  readonly buildsWireCandidateOnly: true;
  readonly executesRuntimeInThisStep: false;
  readonly changesConnectorRoutingInThisStep: false;
  readonly wiresWritePathInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly executesGitInThisStep: false;
  readonly callsCursorInThisStep: false;
  readonly callsGitHubInThisStep: false;

  readonly findings: readonly ControlledRuntimeWireCandidateFinding[];
}
