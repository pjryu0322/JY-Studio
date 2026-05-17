/**
 * H44 / H44.5 — pilot execution readiness 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualDryRunRunnerExecutionEnabled: false,
  actualSandboxInvocationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualDryRunRunnerExecutionEnabled: false,
  actualSandboxInvocationEnabled: false,
};

export const PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER =
  "runtimeLimitedPilotReadinessReviewFinalSafetyGate" as const;

export const PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER = "pilotExecutionReadinessBoundary" as const;

export const PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS = [
  "actual runtime orchestration",
  "actual controlled activation",
  "actual pilot activation",
  "actual pilot execution",
  "actual isolated runner invocation",
  "actual isolated runner execution",
  "actual dry-run runner invocation",
  "actual dry-run runner execution",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual sandbox invocation",
  "actual execution",
  "actual execution routing",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual release enforcement",
  "actual approval enforcement",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "retrieval orchestration",
] as const;

export const PILOT_EXECUTION_READINESS_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "pilotactivated=true", label: "pilotActivated=true" },
  { phrase: "pilotexecuted=true", label: "pilotExecuted=true" },
  { phrase: "isolatedrunnerinvoked=true", label: "isolatedRunnerInvoked=true" },
  { phrase: "isolatedrunnerexecuted=true", label: "isolatedRunnerExecuted=true" },
  { phrase: "dryrunrunnerinvoked=true", label: "dryRunRunnerInvoked=true" },
  { phrase: "sandboxinvoked=true", label: "sandboxInvoked=true" },
  { phrase: "runtimeadapterinvoked=true", label: "runtimeAdapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
  { phrase: "actualpilotactivationforbidden=false", label: "actualPilotActivationForbidden=false" },
  { phrase: "actualpilotexecutionforbidden=false", label: "actualPilotExecutionForbidden=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
];

export const PILOT_EXECUTION_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "limited pilot readiness review final gate ready_metadata",
  "h44 entry readiness ready_metadata",
] as const;

export const PILOT_EXECUTION_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "limited pilot readiness review final gate ready_metadata",
  "h44 entry readiness ready_metadata",
] as const;

export const PILOT_EXECUTION_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualPilotActivationEnabled:false",
  "actualPilotExecutionEnabled:false",
  "actualIsolatedRunnerInvocationEnabled:false",
  "actualSandboxInvocationEnabled:false",
  "actualExecutionEnabled:false",
  "finalPilotNoExecutionProof.diagnosticOnly:true",
  "finalPilotExecutionForbiddenProof.complete:true",
] as const;

export const RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS = [
  "actualPilotActivationForbidden",
  "actualPilotExecutionForbidden",
  "actualIsolatedRunnerInvocationForbidden",
  "actualIsolatedRunnerExecutionForbidden",
  "actualDryRunRunnerInvocationForbidden",
  "actualDryRunRunnerExecutionForbidden",
  "actualNoopShellExecutionForbidden",
  "actualExecutionShellExecutionForbidden",
  "actualAdapterInvocationForbidden",
  "actualSandboxInvocationForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualProviderRoutingForbidden",
  "actualQueueControlForbidden",
  "actualRollbackForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
  "actualExecutionBlockingForbidden",
  "actualMergeBlockingForbidden",
  "actualPromptMutationForbidden",
  "actualTokenEnforcementForbidden",
  "actualContextPruningForbidden",
  "actualRetrievalOrchestrationForbidden",
] as const;
