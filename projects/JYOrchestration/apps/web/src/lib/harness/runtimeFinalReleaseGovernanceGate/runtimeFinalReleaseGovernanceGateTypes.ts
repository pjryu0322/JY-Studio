/**
 * H39 — Final release governance gate **candidate**(read-only; actual enforcement 없음).
 */

export type RuntimeFinalReleaseGovernanceGateCandidateStatus =
  | "not_candidate"
  | "final_release_governance_gate_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeFinalReleaseGovernanceGateMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeFinalReleaseGovernanceGateSummary = Readonly<{
  mode: "runtime_final_release_governance_gate_summary";
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
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  candidateStatus: RuntimeFinalReleaseGovernanceGateCandidateStatus;
  gateMode: RuntimeFinalReleaseGovernanceGateMode;
  rationaleKo: string;
  gateBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeFinalReleaseGovernanceGateScope = Readonly<{
  mode: "runtime_final_release_governance_gate_scope";
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
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  candidateSourceLayer: string;
  candidateTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedGateMetadataScopes: readonly string[];
  forbiddenGateOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeFinalReleaseGovernanceGatePolicy = Readonly<{
  mode: "runtime_final_release_governance_gate_policy";
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
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  gateAllowedMode: RuntimeFinalReleaseGovernanceGateMode;
  operatorReviewBeforeFinalReleaseGate: true;
  rollbackReadinessRequired: true;
  auditTraceRequired: true;
  actualExecutionForbidden: true;
  actualExecutionRoutingForbidden: true;
  actualReleaseEnforcementForbidden: true;
  actualApprovalEnforcementForbidden: true;
  actualShellExecutionForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  actualExecutionBlockingForbidden: true;
  actualMergeBlockingForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimeFinalReleaseGovernanceGateBlockerReport = Readonly<{
  mode: "runtime_final_release_governance_gate_blocker_report";
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
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeFinalReleaseGovernanceGateReadinessChecklist = Readonly<{
  mode: "runtime_final_release_governance_gate_readiness_checklist";
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
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  checklist: readonly string[];
  missingRows: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeFinalReleaseGovernanceGatePlanningReports = Readonly<{
  runtimeFinalReleaseGovernanceGateSummary: RuntimeFinalReleaseGovernanceGateSummary;
  runtimeFinalReleaseGovernanceGateScope: RuntimeFinalReleaseGovernanceGateScope;
  runtimeFinalReleaseGovernanceGatePolicy: RuntimeFinalReleaseGovernanceGatePolicy;
  runtimeFinalReleaseGovernanceGateBlockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
  runtimeFinalReleaseGovernanceGateReadinessChecklist: RuntimeFinalReleaseGovernanceGateReadinessChecklist;
}>;
