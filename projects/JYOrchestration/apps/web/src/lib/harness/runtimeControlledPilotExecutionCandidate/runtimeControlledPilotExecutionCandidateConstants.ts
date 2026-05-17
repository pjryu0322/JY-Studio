/**
 * H45 — controlled pilot execution candidate 공통 상수(read-only).
 */

import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";
import { SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";
import { PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED =
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS =
  SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS;

export const RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER =
  "runtimePilotExecutionReadinessFinalSafetyGate" as const;

export const RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER = "finalRuntimeHandoffBoundary" as const;

export const CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER =
  "runtimePilotExecutionReadinessFinalSafetyGate" as const;

export const CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER = "controlledPilotExecutionCandidate" as const;

export const CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS = PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS;
