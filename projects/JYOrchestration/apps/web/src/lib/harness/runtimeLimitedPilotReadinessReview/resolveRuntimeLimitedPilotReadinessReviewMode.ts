/**
 * H43 — limited pilot readiness review **mode** 해석(read-only).
 */

import type {
  RuntimeLimitedPilotReadinessReviewMode,
  RuntimeLimitedPilotReadinessReviewStatus,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function resolveRuntimeLimitedPilotReadinessReviewMode(
  reviewStatus: RuntimeLimitedPilotReadinessReviewStatus
): RuntimeLimitedPilotReadinessReviewMode {
  switch (reviewStatus) {
    case "limited_pilot_readiness_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
