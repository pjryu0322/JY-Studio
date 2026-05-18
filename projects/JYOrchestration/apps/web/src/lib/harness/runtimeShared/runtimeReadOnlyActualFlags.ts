/**
 * H20.5~H40 — read-only orchestration chain 공통 actual-disabled 플래그.
 * 계층별 `RUNTIME_*_ACTUAL_FLAGS_DISABLED`는 이 객체를 재export한다.
 */

export const RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED = {
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

export type RuntimeReadOnlyOrchestrationActualFlagsDisabled =
  typeof RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
};
