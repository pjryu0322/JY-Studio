/**
 * H22.5 — planning reports 기준 **runtime control boundary** 판정(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeControlScopeMatrix } from "./buildRuntimeControlScopeMatrix";
import type {
  RuntimeControlBoundaryLevel,
  RuntimeControlBoundaryRisk,
  RuntimeControlBoundarySummary,
} from "./runtimeControlBoundaryTypes";

function mergeSortedUnique(rows: readonly string[]): readonly string[] {
  return [...new Set(rows.map((s) => String(s ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

const RATIONALE_KO_BY_LEVEL: Record<RuntimeControlBoundaryLevel, string> = {
  actual_control_forbidden:
    "Control boundary 메타상 actual control 구간 — 실행·할당·라우팅 없음.",
  read_only: "관측 전용 read-only 경계 — allocation trial 대상 없음.",
  dry_run_metadata: "Dry-run 가능성 메타만 — 실제 trial 실행 없음.",
  execution_candidate_metadata:
    "Execution candidate 설명 메타만 — H23 이전 단계; actual orchestration 없음.",
  planning_metadata: "Planning metadata 경계 — execution·control 신호로 해석 금지.",
};

function resolveBoundaryRisk(input: {
  readonly level: RuntimeControlBoundaryLevel;
  readonly trialConsistency: string;
  readonly driftLevel: string;
}): RuntimeControlBoundaryRisk {
  if (input.level === "actual_control_forbidden") return "blocked";
  if (input.trialConsistency === "blocked" || input.driftLevel === "blocked") return "blocked";
  if (input.trialConsistency === "drift_detected") return "violation_candidate";
  if (input.trialConsistency === "watch" || input.driftLevel === "watch" || input.driftLevel === "elevated") {
    return "watch";
  }
  return "stable";
}

export function evaluateRuntimeControlBoundary(
  reports: RuntimeSemanticPlanningReportsBeforeControlBoundary
): RuntimeControlBoundarySummary {
  const trial = reports.runtimeResourceAllocationTrialReport;
  const govBoundary = reports.runtimeResourceControlBoundary.boundary;
  const allocMode = reports.runtimeResourceAllocationPlan.globalAllocationMode;
  const govMode = reports.runtimeResourceGovernanceSummary.governanceMode;
  const drift = reports.runtimeAllocationTrialDriftSummary.driftLevel;
  const consistency = trial.consistency;

  let boundaryLevel: RuntimeControlBoundaryLevel;
  const blockedReasons: string[] = [];

  if (
    trial.trialMode === "dry_run_blocked" ||
    govBoundary === "control_not_allowed" ||
    allocMode === "blocked_by_governance"
  ) {
    boundaryLevel = "actual_control_forbidden";
    blockedReasons.push("trial 차단·governance control_not_allowed·또는 allocation blocked — actual control 금지(메타)");
  } else if (trial.trialMode === "dry_run_ready") {
    boundaryLevel = "dry_run_metadata";
  } else if (allocMode === "planning_only") {
    boundaryLevel = "planning_metadata";
  } else if (govMode === "observe_only" && trial.trialMode === "not_applicable" && allocMode === "not_needed") {
    boundaryLevel = "read_only";
  } else if (allocMode === "dry_run_candidate") {
    boundaryLevel = "execution_candidate_metadata";
  } else if (trial.trialMode === "dry_run_watch") {
    boundaryLevel = "planning_metadata";
  } else {
    boundaryLevel = "planning_metadata";
  }

  const scopes = buildRuntimeControlScopeMatrix(boundaryLevel);
  const boundaryRisk = resolveBoundaryRisk({
    level: boundaryLevel,
    trialConsistency: consistency,
    driftLevel: drift,
  });

  const rationaleKo = RATIONALE_KO_BY_LEVEL[boundaryLevel];

  const recommendations = mergeSortedUnique([
    ...trial.recommendations,
    ...reports.runtimeResourceGovernanceSummary.recommendations,
    ...(boundaryRisk === "violation_candidate" ? ["drift·trial consistency가 불안정 — operator review 메타 선행"] : []),
    ...(boundaryLevel === "actual_control_forbidden"
      ? ["rollback readiness·governance 메타를 먼저 확인 — actual control 경로 없음"]
      : []),
  ]);

  return {
    mode: "runtime_control_boundary_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualControlEnabled: false,
    boundaryLevel,
    boundaryRisk,
    rationaleKo,
    blockedReasons: mergeSortedUnique(blockedReasons),
    allowedMetadataScopes: scopes.allowedMetadataScopes,
    forbiddenControlScopes: scopes.forbiddenControlScopes,
    recommendations,
  };
}
