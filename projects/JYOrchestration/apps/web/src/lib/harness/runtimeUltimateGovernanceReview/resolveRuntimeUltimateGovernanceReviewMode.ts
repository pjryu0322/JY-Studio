/**
 * H40 — ultimate governance review status → review mode(read-only).
 */

import type {
  RuntimeUltimateGovernanceReviewMode,
  RuntimeUltimateGovernanceReviewStatus,
} from "./runtimeUltimateGovernanceReviewTypes";

export function resolveRuntimeUltimateGovernanceReviewMode(
  reviewStatus: RuntimeUltimateGovernanceReviewStatus
): RuntimeUltimateGovernanceReviewMode {
  switch (reviewStatus) {
    case "ultimate_governance_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
