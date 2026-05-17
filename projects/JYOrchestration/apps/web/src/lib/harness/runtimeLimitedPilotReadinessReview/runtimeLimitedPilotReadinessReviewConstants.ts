/**
 * H43 — limited pilot readiness review 공통 상수(read-only).
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
