/**
 * H41 — controlled activation candidate 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
};

export const RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER =
  "runtimeUltimateGovernanceReviewFinalSafetyGate" as const;

export const RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER = "runtimeControlHandoffBoundary" as const;

export const CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER =
  "runtimeUltimateGovernanceReviewFinalSafetyGate" as const;

export const CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER = "controlledActivationCandidate" as const;

export const CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS = [
  "actual runtime orchestration",
  "actual controlled activation",
  "actual pilot activation",
  "actual pilot execution",
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
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
