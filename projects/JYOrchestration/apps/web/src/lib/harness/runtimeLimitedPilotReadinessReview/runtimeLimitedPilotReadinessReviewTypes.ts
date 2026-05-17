/**
 * H43 — Limited runtime pilot readiness review & pilot contract hardening(read-only).
 */

export type RuntimeLimitedPilotReadinessReviewStatus =
  | "not_ready"
  | "limited_pilot_readiness_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeLimitedPilotReadinessReviewMode = "disabled" | "metadata_only" | "blocked";

type RuntimeLimitedPilotReadinessReviewActualFlagsDisabled = Readonly<{
  actualRuntimeOrchestrationEnabled: false;
  actualControlledActivationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualReleaseEnforcementEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
}>;

export type RuntimeLimitedPilotReadinessReviewSummary = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_limited_pilot_readiness_review_summary";
    reviewStatus: RuntimeLimitedPilotReadinessReviewStatus;
    reviewMode: RuntimeLimitedPilotReadinessReviewMode;
    rationaleKo: string;
    reviewBlockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotContractHardeningBoundary = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_contract_hardening_boundary";
    boundarySourceLayer: string;
    boundaryTargetLayer: string;
    allowedBoundaryScopes: readonly string[];
    requiredBoundaryInputs: readonly string[];
    expectedBoundaryOutputs: readonly string[];
    forbiddenBoundaryOperations: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotReadinessInputEnvelope = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_readiness_input_envelope";
    envelopeRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotReadinessOutputEnvelope = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_readiness_output_envelope";
    envelopeRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotNoExecutionProof = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_no_execution_proof";
    pilotActivated: false;
    pilotExecuted: false;
    isolatedRunnerInvoked: false;
    isolatedRunnerExecuted: false;
    dryRunRunnerInvoked: false;
    dryRunRunnerExecuted: false;
    noopShellExecuted: false;
    executionShellExecuted: false;
    runtimeAdapterInvoked: false;
    sandboxInvoked: false;
    executionPerformed: false;
    executionRoutingPerformed: false;
    providerRoutingPerformed: false;
    queueControlPerformed: false;
    rollbackPerformed: false;
    releaseEnforced: false;
    approvalEnforced: false;
    executionBlocked: false;
    mergeBlocked: false;
    promptMutated: false;
    tokenEnforced: false;
    contextPruned: false;
    retrievalOrchestrated: false;
    diagnosticOnly: true;
    proofRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionForbiddenProof = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_execution_forbidden_proof";
    actualPilotActivationForbidden: true;
    actualPilotExecutionForbidden: true;
    actualIsolatedRunnerInvocationForbidden: true;
    actualIsolatedRunnerExecutionForbidden: true;
    actualDryRunRunnerInvocationForbidden: true;
    actualDryRunRunnerExecutionForbidden: true;
    actualNoopShellExecutionForbidden: true;
    actualExecutionShellExecutionForbidden: true;
    actualAdapterInvocationForbidden: true;
    actualSandboxInvocationForbidden: true;
    actualExecutionForbidden: true;
    actualExecutionRoutingForbidden: true;
    actualProviderRoutingForbidden: true;
    actualQueueControlForbidden: true;
    actualRollbackForbidden: true;
    actualReleaseEnforcementForbidden: true;
    actualApprovalEnforcementForbidden: true;
    actualExecutionBlockingForbidden: true;
    actualMergeBlockingForbidden: true;
    actualPromptMutationForbidden: true;
    actualTokenEnforcementForbidden: true;
    actualContextPruningForbidden: true;
    actualRetrievalOrchestrationForbidden: true;
    proofRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotReadinessBlockerReport = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_readiness_blocker_report";
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotContractReadinessChecklist = Readonly<
  RuntimeLimitedPilotReadinessReviewActualFlagsDisabled & {
    mode: "runtime_pilot_contract_readiness_checklist";
    checklist: readonly string[];
    missingRows: readonly string[];
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeLimitedPilotReadinessReviewPlanningReports = Readonly<{
  runtimeLimitedPilotReadinessReviewSummary: RuntimeLimitedPilotReadinessReviewSummary;
  runtimePilotContractHardeningBoundary: RuntimePilotContractHardeningBoundary;
  runtimePilotReadinessInputEnvelope: RuntimePilotReadinessInputEnvelope;
  runtimePilotReadinessOutputEnvelope: RuntimePilotReadinessOutputEnvelope;
  runtimePilotNoExecutionProof: RuntimePilotNoExecutionProof;
  runtimePilotExecutionForbiddenProof: RuntimePilotExecutionForbiddenProof;
  runtimePilotReadinessBlockerReport: RuntimePilotReadinessBlockerReport;
  runtimePilotContractReadinessChecklist: RuntimePilotContractReadinessChecklist;
}>;
