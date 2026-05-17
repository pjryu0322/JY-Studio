/**
 * H44 — pilot execution readiness **mode** 해석(read-only).
 */

import type {
  RuntimePilotExecutionReadinessMode,
  RuntimePilotExecutionReadinessStatus,
} from "./runtimePilotExecutionReadinessTypes";

export function resolveRuntimePilotExecutionReadinessMode(
  readinessStatus: RuntimePilotExecutionReadinessStatus
): RuntimePilotExecutionReadinessMode {
  switch (readinessStatus) {
    case "pilot_execution_readiness_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
