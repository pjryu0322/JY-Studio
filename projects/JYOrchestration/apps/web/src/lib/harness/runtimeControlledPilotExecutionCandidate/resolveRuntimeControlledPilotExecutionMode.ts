/**
 * H45 — controlled pilot execution **mode** 해석(read-only).
 */

import type {
  RuntimeControlledPilotExecutionCandidateStatus,
  RuntimeControlledPilotExecutionMode,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function resolveRuntimeControlledPilotExecutionMode(
  candidateStatus: RuntimeControlledPilotExecutionCandidateStatus
): RuntimeControlledPilotExecutionMode {
  if (candidateStatus === "controlled_pilot_execution_metadata_candidate") {
    return "metadata_only";
  }
  if (candidateStatus === "blocked") {
    return "blocked";
  }
  return "disabled";
}
