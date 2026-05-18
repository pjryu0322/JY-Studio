/**
 * H43 / H43.5 — limited pilot readiness review 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualDryRunRunnerExecutionEnabled: false,
  actualSandboxInvocationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualDryRunRunnerExecutionEnabled: false,
  actualSandboxInvocationEnabled: false,
};

export const PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER =
  "runtimeLimitedPilotBoundaryFinalSafetyGate" as const;

export const PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER = "pilotContractHardeningBoundary" as const;

export const PILOT_CONTRACT_FORBIDDEN_BOUNDARY_OPERATIONS = [
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

export const RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS = [
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

export type RuntimePilotExecutionForbiddenProofRequiredKey =
  (typeof RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS)[number];

export const PILOT_READINESS_REVIEW_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "pilotactivated=true", label: "pilotActivated=true" },
  { phrase: "pilotexecuted=true", label: "pilotExecuted=true" },
  { phrase: "isolatedrunnerinvoked=true", label: "isolatedRunnerInvoked=true" },
  { phrase: "sandboxinvoked=true", label: "sandboxInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
  { phrase: "actualpilotactivationforbidden=false", label: "actualPilotActivationForbidden=false" },
  { phrase: "actualpilotexecutionforbidden=false", label: "actualPilotExecutionForbidden=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
];

export const PILOT_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "limited pilot boundary final gate ready_metadata",
  "h43 entry readiness ready_metadata",
  "limited pilot boundary verification verified_metadata",
  "limited pilot boundary alignment aligned_metadata",
] as const;

export const PILOT_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "limited pilot boundary final gate ready_metadata",
  "h43 entry readiness ready_metadata",
  "no limited pilot boundary actual flag violations",
  "no limited pilot boundary policy violations",
] as const;

export const PILOT_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualPilotActivationEnabled:false",
  "actualPilotExecutionEnabled:false",
  "actualIsolatedRunnerInvocationEnabled:false",
  "actualSandboxInvocationEnabled:false",
  "actualExecutionEnabled:false",
  "pilotNoExecutionProof.diagnosticOnly:true",
  "pilotExecutionForbiddenProof.complete:true",
] as const;
