/**
 * H38 — governance release readiness → readiness mode 매핑(read-only).
 */

import type {
  RuntimeGovernanceReleaseReadinessMode,
  RuntimeGovernanceReleaseReadinessStatus,
} from "./runtimeGovernanceReleaseReadinessTypes";

export function resolveRuntimeGovernanceReleaseReadinessMode(
  readinessStatus: RuntimeGovernanceReleaseReadinessStatus
): RuntimeGovernanceReleaseReadinessMode {
  switch (readinessStatus) {
    case "governance_release_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
