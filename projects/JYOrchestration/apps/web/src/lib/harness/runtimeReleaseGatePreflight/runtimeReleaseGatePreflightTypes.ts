/**
 * H35 — Controlled **release-gate final preflight** & execution readiness boundary(read-only).
 */

export type RuntimeReleaseGatePreflightReadiness =
  | "not_ready"
  | "preflight_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeReleaseGatePreflightMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeReleaseGatePreflightSummary = Readonly<{
  mode: "runtime_release_gate_preflight_summary";
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
  preflightReadiness: RuntimeReleaseGatePreflightReadiness;
  preflightMode: RuntimeReleaseGatePreflightMode;
  rationaleKo: string;
  preflightBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGateExecutionReadinessBoundary = Readonly<{
  mode: "runtime_release_gate_execution_readiness_boundary";
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
  boundarySourceLayer: string;
  boundaryTargetLayer: string;
  allowedBoundaryScopes: readonly string[];
  requiredBoundaryInputs: readonly string[];
  expectedBoundaryOutputs: readonly string[];
  forbiddenBoundaryOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGateInputEnvelope = Readonly<{
  mode: "runtime_release_gate_input_envelope";
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
  envelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGateOutputEnvelope = Readonly<{
  mode: "runtime_release_gate_output_envelope";
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
  envelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGateNoExecutionProof = Readonly<{
  mode: "runtime_release_gate_no_execution_proof";
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
  releaseEnforced: false;
  noopShellExecuted: false;
  executionShellExecuted: false;
  runtimeAdapterInvoked: false;
  executionPerformed: false;
  providerRoutingPerformed: false;
  queueControlPerformed: false;
  rollbackPerformed: false;
  promptMutated: false;
  tokenEnforced: false;
  contextPruned: false;
  mergeBlocked: false;
  diagnosticOnly: true;
  proofRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGateOperationForbiddenProof = Readonly<{
  mode: "runtime_release_gate_operation_forbidden_proof";
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
  actualReleaseEnforcementForbidden: true;
  actualShellExecutionForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualExecutionForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  actualPromptMutationForbidden: true;
  actualTokenEnforcementForbidden: true;
  actualContextPruningForbidden: true;
  actualMergeBlockingForbidden: true;
  proofRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGatePreflightBlockerReport = Readonly<{
  mode: "runtime_release_gate_preflight_blocker_report";
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

export type RuntimeReleaseGatePreflightFinalGateStatus =
  | "ready_metadata"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeReleaseGatePreflightReadinessVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeReleaseGatePreflightAlignmentStatus =
  | "aligned_metadata"
  | "partial"
  | "failed";

export type RuntimeReleaseGatePreflightBoundaryViolationReport = Readonly<{
  mode: "runtime_release_gate_preflight_boundary_violation_report";
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
  proofViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGatePreflightReadinessVerificationReport = Readonly<{
  mode: "runtime_release_gate_preflight_readiness_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  verificationStatus: RuntimeReleaseGatePreflightReadinessVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGatePreflightAlignmentReport = Readonly<{
  mode: "runtime_release_gate_preflight_alignment_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  alignmentStatus: RuntimeReleaseGatePreflightAlignmentStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGatePreflightFinalSafetyGate = Readonly<{
  mode: "runtime_release_gate_preflight_final_safety_gate";
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
  finalGateStatus: RuntimeReleaseGatePreflightFinalGateStatus;
  h36EntryReadiness: RuntimeReleaseGatePreflightFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReleaseGatePreflightChecklist = Readonly<{
  mode: "runtime_release_gate_preflight_checklist";
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

export type RuntimeReleaseGatePreflightPlanningReports = Readonly<{
  runtimeReleaseGatePreflightSummary: RuntimeReleaseGatePreflightSummary;
  runtimeReleaseGateExecutionReadinessBoundary: RuntimeReleaseGateExecutionReadinessBoundary;
  runtimeReleaseGateInputEnvelope: RuntimeReleaseGateInputEnvelope;
  runtimeReleaseGateOutputEnvelope: RuntimeReleaseGateOutputEnvelope;
  runtimeReleaseGateNoExecutionProof: RuntimeReleaseGateNoExecutionProof;
  runtimeReleaseGateOperationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
  runtimeReleaseGatePreflightBlockerReport: RuntimeReleaseGatePreflightBlockerReport;
  runtimeReleaseGatePreflightChecklist: RuntimeReleaseGatePreflightChecklist;
  runtimeReleaseGatePreflightBoundaryViolationReport: RuntimeReleaseGatePreflightBoundaryViolationReport;
  runtimeReleaseGatePreflightReadinessVerificationReport: RuntimeReleaseGatePreflightReadinessVerificationReport;
  runtimeReleaseGatePreflightAlignmentReport: RuntimeReleaseGatePreflightAlignmentReport;
  runtimeReleaseGatePreflightFinalSafetyGate: RuntimeReleaseGatePreflightFinalSafetyGate;
}>;
