/**
 * H34 — candidate status → release-gate mode 매핑(read-only).
 */

import type {
  RuntimeNoopShellReleaseGateCandidateStatus,
  RuntimeNoopShellReleaseGateMode,
} from "./runtimeNoopShellReleaseGateTypes";

export function resolveRuntimeNoopShellReleaseGateMode(
  status: RuntimeNoopShellReleaseGateCandidateStatus
): RuntimeNoopShellReleaseGateMode {
  switch (status) {
    case "release_gate_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
