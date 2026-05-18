/**
 * H31 — candidate status → shell mode 매핑(read-only).
 */

import type {
  RuntimeNoopExecutionShellCandidateStatus,
  RuntimeNoopExecutionShellMode,
} from "./runtimeNoopExecutionShellTypes";

export function resolveRuntimeNoopExecutionShellMode(
  status: RuntimeNoopExecutionShellCandidateStatus
): RuntimeNoopExecutionShellMode {
  switch (status) {
    case "shell_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
