/**
 * H40 — ultimate governance review 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED =
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS =
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS;

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
