/**
 * H21 — resource state **control boundary** 판정(read-only; trial은 후보 표시만).
 */

import type { RuntimeResourceGovernanceSummary, RuntimeResourceControlBoundary, RuntimeResourceGovernanceMode } from "./runtimeResourceGovernanceTypes";

export function evaluateRuntimeResourceControlBoundary(
  summary: RuntimeResourceGovernanceSummary
): RuntimeResourceControlBoundary {
  const boundary: RuntimeResourceGovernanceMode = summary.governanceMode;
  const rationaleKo =
    boundary === "control_not_allowed"
      ? "critical bottleneck·governance risk로 trial·control 경로는 메타상 비허용"
      : boundary === "trial_candidate"
        ? "resource·forecast 신호가 trial 후보 범위(실제 trial 아님)"
        : boundary === "planning_only"
          ? "planning metadata 범위에서만 해석 — execution routing 없음"
          : "관측 전용 — policy intervention 신호 미약";

  return {
    mode: "runtime_resource_control_boundary",
    actualRuntimeOrchestrationEnabled: false,
    boundary,
    rationaleKo,
  };
}
