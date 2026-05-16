/**
 * H22.5 — Runtime **control boundary** metadata(read-only; actual control·routing·집행 없음).
 */

export type RuntimeControlBoundaryLevel =
  | "read_only"
  | "planning_metadata"
  | "dry_run_metadata"
  | "execution_candidate_metadata"
  | "actual_control_forbidden";

export type RuntimeControlBoundaryRisk =
  | "stable"
  | "watch"
  | "violation_candidate"
  | "blocked";

export type RuntimeControlBoundarySummary = Readonly<{
  mode: "runtime_control_boundary_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualControlEnabled: false;
  boundaryLevel: RuntimeControlBoundaryLevel;
  boundaryRisk: RuntimeControlBoundaryRisk;
  rationaleKo: string;
  blockedReasons: readonly string[];
  allowedMetadataScopes: readonly string[];
  forbiddenControlScopes: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlBoundaryViolationReport = Readonly<{
  mode: "runtime_control_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualControlEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
}>;

export type RuntimeControlScopeMatrix = Readonly<{
  mode: "runtime_control_scope_matrix";
  actualRuntimeOrchestrationEnabled: false;
  actualControlEnabled: false;
  boundaryLevel: RuntimeControlBoundaryLevel;
  allowedMetadataScopes: readonly string[];
  forbiddenControlScopes: readonly string[];
  notesKo: readonly string[];
}>;

export type RuntimeControlBoundaryPlanningReports = Readonly<{
  runtimeControlBoundarySummary: RuntimeControlBoundarySummary;
  runtimeControlBoundaryViolationReport: RuntimeControlBoundaryViolationReport;
  runtimeControlScopeMatrix: RuntimeControlScopeMatrix;
}>;
