/**
 * H29 — candidate status → invocation mode 매핑(read-only).
 */

import type {
  RuntimeRunnerInvocationCandidateStatus,
  RuntimeRunnerInvocationMode,
} from "./runtimeRunnerInvocationTypes";

export function resolveRuntimeRunnerInvocationMode(
  status: RuntimeRunnerInvocationCandidateStatus
): RuntimeRunnerInvocationMode {
  switch (status) {
    case "invocation_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
