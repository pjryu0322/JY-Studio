/**
 * H40 — ultimate governance review 공통 상수(read-only).
 */

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED = {
  actualRuntimeOrchestrationEnabled: false,
  actualPilotExecutionEnabled: false,
  actualNoopShellExecutionEnabled: false,
  actualExecutionShellExecutionEnabled: false,
  actualReleaseEnforcementEnabled: false,
  actualRuntimeAdapterInvocationEnabled: false,
  actualExecutionEnabled: false,
  actualExecutionRoutingEnabled: false,
  actualProviderRoutingEnabled: false,
  actualQueueControlEnabled: false,
  actualRollbackExecutionEnabled: false,
  actualApprovalEnforcementEnabled: false,
  actualExecutionBlockingEnabled: false,
  actualMergeBlockingEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS = {
  ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
};

export const FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER =
  "runtimeFinalReleaseGovernanceGateFinalSafetyGate" as const;

export const FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER = "finalOrchestrationReadinessBoundary" as const;

export const FINAL_ORCHESTRATION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS = [
  "actual orchestration",
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "retrieval orchestration",
] as const;
