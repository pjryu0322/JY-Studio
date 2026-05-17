/**
 * H45 — Controlled pilot execution candidate & final runtime handoff boundary(read-only).
 */

import type { RuntimePilotExecutionReadinessActualFlagsDisabled } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessTypes";

export type RuntimeControlledPilotExecutionCandidateStatus =
  | "not_candidate"
  | "controlled_pilot_execution_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeControlledPilotExecutionMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeControlledPilotExecutionCandidateSummary = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_candidate_summary";
    candidateStatus: RuntimeControlledPilotExecutionCandidateStatus;
    executionMode: RuntimeControlledPilotExecutionMode;
    rationaleKo: string;
    executionBlockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeFinalRuntimeHandoffBoundary = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_final_runtime_handoff_boundary";
    boundarySourceLayer: string;
    boundaryTargetLayer: string;
    requiredHandoffInputs: readonly string[];
    expectedHandoffOutputs: readonly string[];
    allowedHandoffMetadataScopes: readonly string[];
    forbiddenHandoffOperations: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionCandidateScope = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_candidate_scope";
    candidateSourceLayer: string;
    candidateTargetLayer: string;
    requiredCandidateInputs: readonly string[];
    expectedCandidateOutputs: readonly string[];
    allowedCandidateMetadataScopes: readonly string[];
    forbiddenCandidateOperations: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionCandidatePolicy = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_candidate_policy";
    executionAllowedMode: RuntimeControlledPilotExecutionMode;
    operatorReviewBeforeControlledPilotExecution: true;
    rollbackReadinessRequired: true;
    auditTraceRequired: true;
    actualRuntimeOrchestrationForbidden: true;
    actualControlledActivationForbidden: true;
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
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionInputContract = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_input_contract";
    contractRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionOutputContract = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_output_contract";
    contractRows: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionCandidateBlockerReport = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_candidate_blocker_report";
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionReadinessChecklist = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_controlled_pilot_execution_readiness_checklist";
    checklist: readonly string[];
    missingRows: readonly string[];
    blockers: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimeControlledPilotExecutionCandidatePlanningReports = Readonly<{
  runtimeControlledPilotExecutionCandidateSummary: RuntimeControlledPilotExecutionCandidateSummary;
  runtimeFinalRuntimeHandoffBoundary: RuntimeFinalRuntimeHandoffBoundary;
  runtimeControlledPilotExecutionCandidateScope: RuntimeControlledPilotExecutionCandidateScope;
  runtimeControlledPilotExecutionCandidatePolicy: RuntimeControlledPilotExecutionCandidatePolicy;
  runtimeControlledPilotExecutionInputContract: RuntimeControlledPilotExecutionInputContract;
  runtimeControlledPilotExecutionOutputContract: RuntimeControlledPilotExecutionOutputContract;
  runtimeControlledPilotExecutionCandidateBlockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  runtimeControlledPilotExecutionReadinessChecklist: RuntimeControlledPilotExecutionReadinessChecklist;
}>;
