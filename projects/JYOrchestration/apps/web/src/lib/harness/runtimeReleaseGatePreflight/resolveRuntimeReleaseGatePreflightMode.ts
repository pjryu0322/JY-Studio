/**
 * H35 — preflight readiness → preflight mode 매핑(read-only).
 */

import type {
  RuntimeReleaseGatePreflightMode,
  RuntimeReleaseGatePreflightReadiness,
} from "./runtimeReleaseGatePreflightTypes";

export function resolveRuntimeReleaseGatePreflightMode(
  readiness: RuntimeReleaseGatePreflightReadiness
): RuntimeReleaseGatePreflightMode {
  switch (readiness) {
    case "preflight_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}
