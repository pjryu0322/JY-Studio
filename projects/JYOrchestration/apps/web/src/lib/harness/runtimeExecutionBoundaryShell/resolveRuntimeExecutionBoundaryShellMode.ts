/**
 * H36 — candidate status → execution boundary shell mode 매핑(read-only).
 */

import type {
  RuntimeExecutionBoundaryShellCandidateStatus,
  RuntimeExecutionBoundaryShellMode,
} from "./runtimeExecutionBoundaryShellTypes";

export function resolveRuntimeExecutionBoundaryShellMode(
  status: RuntimeExecutionBoundaryShellCandidateStatus
): RuntimeExecutionBoundaryShellMode {
  switch (status) {
    case "boundary_shell_metadata_candidate":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
