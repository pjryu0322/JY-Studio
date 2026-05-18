/**
 * H39 — candidate status → final release governance gate mode(read-only).
 */

import type {
  RuntimeFinalReleaseGovernanceGateCandidateStatus,
  RuntimeFinalReleaseGovernanceGateMode,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function resolveRuntimeFinalReleaseGovernanceGateMode(
  status: RuntimeFinalReleaseGovernanceGateCandidateStatus
): RuntimeFinalReleaseGovernanceGateMode {
  switch (status) {
    case "final_release_governance_gate_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
