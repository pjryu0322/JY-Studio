/**
 * H44 — Limited runtime pilot readiness finalization & pilot execution readiness boundary(read-only).
 */

export type RuntimePilotExecutionReadinessStatus =
  | "not_ready"
  | "pilot_execution_readiness_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimePilotExecutionReadinessMode = "disabled" | "metadata_only" | "blocked";

type RuntimePilotExecutionReadinessActualFlagsDisabled = Readonly<{
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

export type RuntimePilotExecutionReadinessSummary = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_summary";
    readinessStatus: RuntimePilotExecutionReadinessStatus;
    readinessMode: RuntimePilotExecutionReadinessMode;
    rationaleKo: string;
    readinessBlockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionReadinessBoundary = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_boundary";
    boundarySourceLayer: string;
    boundaryTargetLayer: string;
    allowedBoundaryScopes: readonly string[];
    requiredBoundaryInputs: readonly string[];
    expectedBoundaryOutputs: readonly string[];
    forbiddenBoundaryOperations: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionReadinessInputEnvelope = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_input_envelope";
    envelopeRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionReadinessOutputEnvelope = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_output_envelope";
    envelopeRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeFinalPilotNoExecutionProof = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_final_pilot_no_execution_proof";
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

export type RuntimeFinalPilotExecutionForbiddenProof = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_final_pilot_execution_forbidden_proof";
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

export type RuntimePilotExecutionReadinessBlockerReport = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_blocker_report";
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionReadinessChecklist = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_execution_readiness_checklist";
    checklist: readonly string[];
    missingRows: readonly string[];
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotExecutionReadinessPlanningReports = Readonly<{
  runtimePilotExecutionReadinessSummary: RuntimePilotExecutionReadinessSummary;
  runtimePilotExecutionReadinessBoundary: RuntimePilotExecutionReadinessBoundary;
  runtimePilotExecutionReadinessInputEnvelope: RuntimePilotExecutionReadinessInputEnvelope;
  runtimePilotExecutionReadinessOutputEnvelope: RuntimePilotExecutionReadinessOutputEnvelope;
  runtimeFinalPilotNoExecutionProof: RuntimeFinalPilotNoExecutionProof;
  runtimeFinalPilotExecutionForbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
  runtimePilotExecutionReadinessBlockerReport: RuntimePilotExecutionReadinessBlockerReport;
  runtimePilotExecutionReadinessChecklist: RuntimePilotExecutionReadinessChecklist;
}>;
