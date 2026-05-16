/**
 * H22 — allocation plan 기준 **dry-run trial readiness** 평가(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeAllocationTrialDriftSummary,
  RuntimeResourceAllocationTrialReport,
  RuntimeResourceTrialConsistency,
  RuntimeResourceTrialForecastComparison,
  RuntimeResourceTrialGovernanceComparison,
  RuntimeResourceTrialMode,
} from "./runtimeResourceTrialTypes";

function mergeSortedUnique(rows: readonly string[]): readonly string[] {
  return [...new Set(rows.map((s) => String(s ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function resolveConsistency(input: {
  readonly trialMode: RuntimeResourceTrialMode;
  readonly drift: RuntimeAllocationTrialDriftSummary;
  readonly forecast: RuntimeResourceTrialForecastComparison;
  readonly governance: RuntimeResourceTrialGovernanceComparison;
}): RuntimeResourceTrialConsistency {
  if (input.trialMode === "dry_run_blocked" || input.drift.driftLevel === "blocked") return "blocked";
  if (input.trialMode === "dry_run_watch") return "watch";
  if (input.trialMode === "not_applicable") return "consistent";
  if (
    input.drift.driftLevel === "elevated" ||
    !input.forecast.aligned ||
    !input.governance.aligned ||
    input.drift.driftFindings.length > 0
  ) {
    return "drift_detected";
  }
  if (input.drift.driftLevel === "watch") return "watch";
  return "consistent";
}

export function evaluateRuntimeResourceAllocationTrial(
  reports: RuntimeSemanticPlanningReportsBeforeTrial,
  ctx: Readonly<{
    forecastComparison: RuntimeResourceTrialForecastComparison;
    governanceComparison: RuntimeResourceTrialGovernanceComparison;
    driftSummary: RuntimeAllocationTrialDriftSummary;
  }>
): RuntimeResourceAllocationTrialReport {
  const global = reports.runtimeResourceAllocationPlan.globalAllocationMode;
  const boundary = reports.runtimeResourceControlBoundary.boundary;
  const gov = reports.runtimeResourceGovernanceSummary;
  const stab = reports.runtimeForecastStability.outlook;

  let trialMode: RuntimeResourceTrialMode;
  const blockedReasons: string[] = [];
  const satisfied: string[] = [];

  if (global === "not_needed") {
    trialMode = "not_applicable";
    satisfied.push("global allocation not_needed — trial 적용 범위 없음");
  } else if (global === "blocked_by_governance" || boundary === "control_not_allowed") {
    trialMode = "dry_run_blocked";
    blockedReasons.push("governance boundary 또는 allocation 모드에 의해 dry-run trial 차단(메타)");
  } else if (global === "planning_only") {
    trialMode = "dry_run_watch";
    satisfied.push("planning_only 범위 — execution trial 없이 관찰만");
  } else {
    const criticalGov = gov.governanceRisk === "critical_candidate";
    const criticalForecast = stab === "critical_candidate";
    if (criticalGov || criticalForecast) {
      trialMode = "dry_run_watch";
    } else {
      trialMode = "dry_run_ready";
      satisfied.push("governance risk·forecast stability가 critical이 아님 — dry-run readiness 메타");
    }
  }

  const consistency = resolveConsistency({
    trialMode,
    drift: ctx.driftSummary,
    forecast: ctx.forecastComparison,
    governance: ctx.governanceComparison,
  });

  const recommendations = mergeSortedUnique([
    ...reports.runtimeResourceGovernanceSummary.recommendations,
    ...reports.runtimeResourceAllocationPlan.recommendationRows,
    ...(consistency === "drift_detected" ? ["drift 발견 — operator review·rollback readiness 메타를 선행 확인"] : []),
  ]);

  const readinessKo =
    trialMode === "dry_run_blocked"
      ? "Dry-run trial은 governance·boundary 신호로 차단됨(실행 없음)."
      : trialMode === "not_applicable"
        ? "할당 trial 대상 아님 — 관측 전용 메타."
        : trialMode === "dry_run_ready"
          ? "Dry-run trial readiness 메타상 준비 — 실제 trial·할당 없음."
          : "Dry-run trial은 watch 범위 — 추가 관측·검토 권장.";

  return {
    mode: "runtime_resource_allocation_trial_report",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    actualTrialExecutionEnabled: false,
    trialMode,
    consistency,
    readinessKo,
    blockedReasons: mergeSortedUnique(blockedReasons),
    satisfiedConditions: mergeSortedUnique(satisfied),
    recommendations,
  };
}
