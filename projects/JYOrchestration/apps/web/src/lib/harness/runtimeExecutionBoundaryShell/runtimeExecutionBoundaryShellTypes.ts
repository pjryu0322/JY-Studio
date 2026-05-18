/**
 * H36 — Execution boundary **metadata shell candidate**(read-only; actual execution 없음).
 */

export type RuntimeExecutionBoundaryShellCandidateStatus =
  | "not_candidate"
  | "boundary_shell_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeExecutionBoundaryShellMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeExecutionBoundaryShellFinalGateStatus =
  | "ready_metadata"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeExecutionBoundaryShellReadinessVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeExecutionBoundaryShellAlignmentStatus = "aligned_metadata" | "partial" | "failed";

export type RuntimeExecutionBoundaryShellSummary = Readonly<{
  mode: "runtime_execution_boundary_shell_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  candidateStatus: RuntimeExecutionBoundaryShellCandidateStatus;
  shellMode: RuntimeExecutionBoundaryShellMode;
  rationaleKo: string;
  shellBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellScope = Readonly<{
  mode: "runtime_execution_boundary_shell_scope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  candidateSourceLayer: string;
  candidateTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedShellMetadataScopes: readonly string[];
  forbiddenShellOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellPolicy = Readonly<{
  mode: "runtime_execution_boundary_shell_policy";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  shellAllowedMode: RuntimeExecutionBoundaryShellMode;
  operatorReviewBeforeExecutionBoundary: true;
  rollbackReadinessRequired: true;
  auditTraceRequired: true;
  actualExecutionForbidden: true;
  actualExecutionRoutingForbidden: true;
  actualReleaseEnforcementForbidden: true;
  actualShellExecutionForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellBlockerReport = Readonly<{
  mode: "runtime_execution_boundary_shell_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellReadinessChecklist = Readonly<{
  mode: "runtime_execution_boundary_shell_readiness_checklist";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  checklist: readonly string[];
  missingRows: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellBoundaryViolationReport = Readonly<{
  mode: "runtime_execution_boundary_shell_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellReadinessVerificationReport = Readonly<{
  mode: "runtime_execution_boundary_shell_readiness_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  verificationStatus: RuntimeExecutionBoundaryShellReadinessVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellAlignmentReport = Readonly<{
  mode: "runtime_execution_boundary_shell_alignment_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  alignmentStatus: RuntimeExecutionBoundaryShellAlignmentStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellFinalSafetyGate = Readonly<{
  mode: "runtime_execution_boundary_shell_final_safety_gate";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  finalGateStatus: RuntimeExecutionBoundaryShellFinalGateStatus;
  h37EntryReadiness: RuntimeExecutionBoundaryShellFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionBoundaryShellPlanningReports = Readonly<{
  runtimeExecutionBoundaryShellSummary: RuntimeExecutionBoundaryShellSummary;
  runtimeExecutionBoundaryShellScope: RuntimeExecutionBoundaryShellScope;
  runtimeExecutionBoundaryShellPolicy: RuntimeExecutionBoundaryShellPolicy;
  runtimeExecutionBoundaryShellBlockerReport: RuntimeExecutionBoundaryShellBlockerReport;
  runtimeExecutionBoundaryShellReadinessChecklist: RuntimeExecutionBoundaryShellReadinessChecklist;
  runtimeExecutionBoundaryShellBoundaryViolationReport: RuntimeExecutionBoundaryShellBoundaryViolationReport;
  runtimeExecutionBoundaryShellReadinessVerificationReport: RuntimeExecutionBoundaryShellReadinessVerificationReport;
  runtimeExecutionBoundaryShellAlignmentReport: RuntimeExecutionBoundaryShellAlignmentReport;
  runtimeExecutionBoundaryShellFinalSafetyGate: RuntimeExecutionBoundaryShellFinalSafetyGate;
}>;
