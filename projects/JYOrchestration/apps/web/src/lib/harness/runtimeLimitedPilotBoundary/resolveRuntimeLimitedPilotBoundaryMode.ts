/**
 * H42 — limited pilot boundary **mode** 해석(read-only).
 */

import type {
  RuntimeLimitedPilotBoundaryCandidateStatus,
  RuntimeLimitedPilotBoundaryMode,
} from "./runtimeLimitedPilotBoundaryTypes";

export function resolveRuntimeLimitedPilotBoundaryMode(
  candidateStatus: RuntimeLimitedPilotBoundaryCandidateStatus
): RuntimeLimitedPilotBoundaryMode {
  switch (candidateStatus) {
    case "limited_pilot_boundary_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
