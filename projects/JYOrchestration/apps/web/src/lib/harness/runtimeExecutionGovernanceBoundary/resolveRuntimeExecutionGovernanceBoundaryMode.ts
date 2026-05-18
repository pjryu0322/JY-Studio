/**
 * H37 — candidate status → governance boundary mode 매핑(read-only).
 */

import type {
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
  RuntimeExecutionGovernanceBoundaryMode,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function resolveRuntimeExecutionGovernanceBoundaryMode(
  status: RuntimeExecutionGovernanceBoundaryCandidateStatus
): RuntimeExecutionGovernanceBoundaryMode {
  switch (status) {
    case "governance_boundary_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
