/**
 * H23 — Orchestration **execution candidate** metadata(read-only; actual execution·routing 없음).
 */

export type RuntimeExecutionCandidateStatus =
  | "not_candidate"
  | "metadata_candidate"
  | "operator_review_required"
  | "blocked";

export type RuntimeExecutionCandidateRisk = "stable" | "watch" | "elevated" | "blocked";

export type RuntimeExecutionCandidateSummary = Readonly<{
  mode: "runtime_execution_candidate_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualExecutionEnabled: false;
  candidateStatus: RuntimeExecutionCandidateStatus;
  candidateRisk: RuntimeExecutionCandidateRisk;
  rationaleKo: string;
  candidatePreconditions: readonly string[];
  candidateBlockers: readonly string[];
  requiredApprovals: readonly string[];
  rollbackPrerequisites: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionCandidateScope = Readonly<{
  mode: "runtime_execution_candidate_scope";
  actualRuntimeOrchestrationEnabled: false;
  actualExecutionEnabled: false;
  sourceLayer: string;
  targetLayer: string;
  candidateInputs: readonly string[];
  candidateOutputs: readonly string[];
  allowedMetadataScopes: readonly string[];
  forbiddenExecutionScopes: readonly string[];
}>;

export type RuntimeExecutionCandidatePreconditions = Readonly<{
  mode: "runtime_execution_candidate_preconditions";
  actualRuntimeOrchestrationEnabled: false;
  actualExecutionEnabled: false;
  preconditions: readonly string[];
}>;

export type RuntimeExecutionCandidateBlockersReport = Readonly<{
  mode: "runtime_execution_candidate_blockers";
  actualRuntimeOrchestrationEnabled: false;
  actualExecutionEnabled: false;
  blockers: readonly string[];
}>;

export type RuntimeExecutionCandidatePlanningReports = Readonly<{
  runtimeExecutionCandidateSummary: RuntimeExecutionCandidateSummary;
  runtimeExecutionCandidateScope: RuntimeExecutionCandidateScope;
  runtimeExecutionCandidatePreconditions: RuntimeExecutionCandidatePreconditions;
  runtimeExecutionCandidateBlockers: RuntimeExecutionCandidateBlockersReport;
}>;
