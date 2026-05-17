/**
 * H37 — Execution boundary hardening & final governance boundary **candidate**(read-only; actual execution 없음).
 */

export type RuntimeExecutionGovernanceBoundaryCandidateStatus =
  | "not_candidate"
  | "governance_boundary_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeExecutionGovernanceBoundaryMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeExecutionGovernanceBoundaryHardeningReadiness =
  | "not_ready"
  | "hardening_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeExecutionGovernanceBoundaryFinalGateStatus =
  | "ready_metadata"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeExecutionGovernanceBoundaryReadinessVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeExecutionGovernanceBoundaryAlignmentStatus = "aligned_metadata" | "partial" | "failed";

export type RuntimeExecutionGovernanceBoundarySummary = Readonly<{
  mode: "runtime_execution_governance_boundary_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  candidateStatus: RuntimeExecutionGovernanceBoundaryCandidateStatus;
  governanceMode: RuntimeExecutionGovernanceBoundaryMode;
  hardeningReadiness: RuntimeExecutionGovernanceBoundaryHardeningReadiness;
  rationaleKo: string;
  governanceBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryScope = Readonly<{
  mode: "runtime_execution_governance_boundary_scope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  candidateSourceLayer: string;
  candidateTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedGovernanceMetadataScopes: readonly string[];
  forbiddenGovernanceOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryPolicy = Readonly<{
  mode: "runtime_execution_governance_boundary_policy";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  governanceAllowedMode: RuntimeExecutionGovernanceBoundaryMode;
  operatorReviewBeforeGovernanceBoundary: true;
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
  actualApprovalEnforcementForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryBlockerReport = Readonly<{
  mode: "runtime_execution_governance_boundary_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryReadinessChecklist = Readonly<{
  mode: "runtime_execution_governance_boundary_readiness_checklist";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  checklist: readonly string[];
  missingRows: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryViolationReport = Readonly<{
  mode: "runtime_execution_governance_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryReadinessVerificationReport = Readonly<{
  mode: "runtime_execution_governance_boundary_readiness_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualApprovalEnforcementEnabled: false;
  verificationStatus: RuntimeExecutionGovernanceBoundaryReadinessVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryAlignmentReport = Readonly<{
  mode: "runtime_execution_governance_boundary_alignment_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualApprovalEnforcementEnabled: false;
  alignmentStatus: RuntimeExecutionGovernanceBoundaryAlignmentStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryFinalSafetyGate = Readonly<{
  mode: "runtime_execution_governance_boundary_final_safety_gate";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  finalGateStatus: RuntimeExecutionGovernanceBoundaryFinalGateStatus;
  h38EntryReadiness: RuntimeExecutionGovernanceBoundaryFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeExecutionGovernanceBoundaryPlanningReports = Readonly<{
  runtimeExecutionGovernanceBoundarySummary: RuntimeExecutionGovernanceBoundarySummary;
  runtimeExecutionGovernanceBoundaryScope: RuntimeExecutionGovernanceBoundaryScope;
  runtimeExecutionGovernanceBoundaryPolicy: RuntimeExecutionGovernanceBoundaryPolicy;
  runtimeExecutionGovernanceBoundaryBlockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
  runtimeExecutionGovernanceBoundaryReadinessChecklist: RuntimeExecutionGovernanceBoundaryReadinessChecklist;
  runtimeExecutionGovernanceBoundaryViolationReport: RuntimeExecutionGovernanceBoundaryViolationReport;
  runtimeExecutionGovernanceBoundaryReadinessVerificationReport: RuntimeExecutionGovernanceBoundaryReadinessVerificationReport;
  runtimeExecutionGovernanceBoundaryAlignmentReport: RuntimeExecutionGovernanceBoundaryAlignmentReport;
  runtimeExecutionGovernanceBoundaryFinalSafetyGate: RuntimeExecutionGovernanceBoundaryFinalSafetyGate;
}>;
