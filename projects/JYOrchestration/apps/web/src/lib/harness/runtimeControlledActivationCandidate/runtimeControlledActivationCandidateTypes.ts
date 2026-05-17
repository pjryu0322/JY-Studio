/**
 * H41 — Controlled activation candidate & runtime control handoff boundary(read-only).
 */

export type RuntimeControlledActivationCandidateStatus =
  | "not_candidate"
  | "controlled_activation_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeControlledActivationMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeControlledActivationCandidateFinalGateStatus =
  | "ready_metadata"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeControlledActivationCandidateVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeControlledActivationCandidateAlignmentStatus =
  | "aligned_metadata"
  | "partial"
  | "failed";

export type RuntimeControlledActivationCandidateSummary = Readonly<{
  mode: "runtime_controlled_activation_candidate_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  candidateStatus: RuntimeControlledActivationCandidateStatus;
  activationMode: RuntimeControlledActivationMode;
  rationaleKo: string;
  activationBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlHandoffBoundary = Readonly<{
  mode: "runtime_control_handoff_boundary";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  boundarySourceLayer: string;
  boundaryTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedHandoffMetadataScopes: readonly string[];
  forbiddenHandoffOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidateScope = Readonly<{
  mode: "runtime_controlled_activation_candidate_scope";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  requiredCandidateInputs: readonly string[];
  expectedCandidateOutputs: readonly string[];
  allowedCandidateMetadataScopes: readonly string[];
  forbiddenCandidateOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidatePolicy = Readonly<{
  mode: "runtime_controlled_activation_candidate_policy";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  activationAllowedMode: RuntimeControlledActivationMode;
  operatorReviewBeforeControlledActivation: true;
  rollbackReadinessRequired: true;
  auditTraceRequired: true;
  actualRuntimeOrchestrationForbidden: true;
  actualControlledActivationForbidden: true;
  actualPilotActivationForbidden: true;
  actualPilotExecutionForbidden: true;
  actualExecutionForbidden: true;
  actualExecutionRoutingForbidden: true;
  actualReleaseEnforcementForbidden: true;
  actualApprovalEnforcementForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  actualExecutionBlockingForbidden: true;
  actualMergeBlockingForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidateBlockerReport = Readonly<{
  mode: "runtime_controlled_activation_candidate_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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

export type RuntimeControlledActivationReadinessChecklist = Readonly<{
  mode: "runtime_controlled_activation_readiness_checklist";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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

export type RuntimeControlledActivationCandidateViolationReport = Readonly<{
  mode: "runtime_controlled_activation_candidate_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  actualFlagViolations: readonly string[];
  policyViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidateVerificationReport = Readonly<{
  mode: "runtime_controlled_activation_candidate_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  verificationStatus: RuntimeControlledActivationCandidateVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidateAlignmentReport = Readonly<{
  mode: "runtime_controlled_activation_candidate_alignment_report";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  alignmentStatus: RuntimeControlledActivationCandidateAlignmentStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidateFinalSafetyGate = Readonly<{
  mode: "runtime_controlled_activation_candidate_final_safety_gate";
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
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
  finalGateStatus: RuntimeControlledActivationCandidateFinalGateStatus;
  h42EntryReadiness: RuntimeControlledActivationCandidateFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledActivationCandidatePlanningReports = Readonly<{
  runtimeControlledActivationCandidateSummary: RuntimeControlledActivationCandidateSummary;
  runtimeControlHandoffBoundary: RuntimeControlHandoffBoundary;
  runtimeControlledActivationCandidateScope: RuntimeControlledActivationCandidateScope;
  runtimeControlledActivationCandidatePolicy: RuntimeControlledActivationCandidatePolicy;
  runtimeControlledActivationCandidateBlockerReport: RuntimeControlledActivationCandidateBlockerReport;
  runtimeControlledActivationReadinessChecklist: RuntimeControlledActivationReadinessChecklist;
  runtimeControlledActivationCandidateViolationReport: RuntimeControlledActivationCandidateViolationReport;
  runtimeControlledActivationCandidateVerificationReport: RuntimeControlledActivationCandidateVerificationReport;
  runtimeControlledActivationCandidateAlignmentReport: RuntimeControlledActivationCandidateAlignmentReport;
  runtimeControlledActivationCandidateFinalSafetyGate: RuntimeControlledActivationCandidateFinalSafetyGate;
}>;
