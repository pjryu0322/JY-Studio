/**
 * H42 — limited pilot boundary 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualSandboxInvocationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualSandboxInvocationEnabled: false,
};

export const LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER =
  "runtimeControlledActivationCandidateFinalSafetyGate" as const;

export const LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER =
  "limitedControlledRuntimePilotBoundaryCandidate" as const;

export const LIMITED_PILOT_FORBIDDEN_OPERATIONS = [
  "actual runtime orchestration",
  "actual controlled activation",
  "actual pilot activation",
  "actual pilot execution",
  "actual isolated runner invocation",
  "actual isolated runner execution",
  "actual dry-run runner invocation",
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
