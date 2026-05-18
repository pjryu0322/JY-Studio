/**
 * H37 — candidate status → boundary hardening readiness 매핑(read-only).
 */

import type {
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
  RuntimeExecutionGovernanceBoundaryHardeningReadiness,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function resolveRuntimeExecutionGovernanceBoundaryHardeningReadiness(
  status: RuntimeExecutionGovernanceBoundaryCandidateStatus
): RuntimeExecutionGovernanceBoundaryHardeningReadiness {
  switch (status) {
    case "governance_boundary_metadata_candidate":
      return "hardening_metadata_ready";
    case "watch":
      return "watch";
    case "blocked":
      return "blocked";
    default:
      return "not_ready";
  }
}
