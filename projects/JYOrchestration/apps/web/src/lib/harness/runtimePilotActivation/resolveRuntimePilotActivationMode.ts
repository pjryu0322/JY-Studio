/**
 * H27 — candidate status → activation mode 매핑(read-only).
 */

import type {
  RuntimePilotActivationCandidateStatus,
  RuntimePilotActivationMode,
} from "./runtimePilotActivationTypes";

export function resolveRuntimePilotActivationMode(
  status: RuntimePilotActivationCandidateStatus
): RuntimePilotActivationMode {
  switch (status) {
    case "activation_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
