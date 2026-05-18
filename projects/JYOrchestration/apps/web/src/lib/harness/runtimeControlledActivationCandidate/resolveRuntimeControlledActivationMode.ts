/**
 * H41 — candidate status → controlled activation mode(read-only).
 */

import type {
  RuntimeControlledActivationCandidateStatus,
  RuntimeControlledActivationMode,
} from "./runtimeControlledActivationCandidateTypes";

export function resolveRuntimeControlledActivationMode(
  status: RuntimeControlledActivationCandidateStatus
): RuntimeControlledActivationMode {
  switch (status) {
    case "controlled_activation_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
