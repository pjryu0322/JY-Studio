/**
 * H22.5 — control boundary planning reports 일괄 산출(read-only; 상위 report 재계산 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeControlScopeMatrix } from "./buildRuntimeControlScopeMatrix";
import { detectRuntimeControlBoundaryViolations } from "./detectRuntimeControlBoundaryViolations";
import { evaluateRuntimeControlBoundary } from "./evaluateRuntimeControlBoundary";
import type {
  RuntimeControlBoundaryPlanningReports,
  RuntimeControlBoundaryRisk,
  RuntimeControlBoundarySummary,
  RuntimeControlScopeMatrix,
} from "./runtimeControlBoundaryTypes";

function mergeSortedUnique(rows: readonly string[]): readonly string[] {
  return [...new Set(rows.map((s) => String(s ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function upgradeRisk(
  base: RuntimeControlBoundaryRisk,
  violations: ReturnType<typeof detectRuntimeControlBoundaryViolations>
): RuntimeControlBoundaryRisk {
  if (base === "blocked") return "blocked";
  if (violations.actualFlagViolations.length > 0) return "blocked";
  if (violations.wordingRiskFindings.length > 0) {
    return base === "stable" || base === "watch" ? "violation_candidate" : base;
  }
  return base;
}

export type { RuntimeControlBoundaryPlanningReports } from "./runtimeControlBoundaryTypes";

export function buildRuntimeControlBoundaryPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeControlBoundary
): RuntimeControlBoundaryPlanningReports {
  const violations = detectRuntimeControlBoundaryViolations(reports);
  const baseSummary = evaluateRuntimeControlBoundary(reports);
  const boundaryRisk = upgradeRisk(baseSummary.boundaryRisk, violations);

  const extraRecs: string[] = [];
  if (violations.actualFlagViolations.length > 0) {
    extraRecs.push("actual*Enabled=true 신호가 탐지됨 — 타입·직렬화 경로 점검(메타)");
  }
  if (violations.wordingRiskFindings.length > 0) {
    extraRecs.push("control 오해 소지 문구 후보 — 운영 문구를 planning metadata로 정렬");
  }

  const runtimeControlBoundarySummary: RuntimeControlBoundarySummary = {
    ...baseSummary,
    boundaryRisk,
    recommendations: mergeSortedUnique([...baseSummary.recommendations, ...extraRecs]),
  };

  const scopes = buildRuntimeControlScopeMatrix(runtimeControlBoundarySummary.boundaryLevel);
  const runtimeControlScopeMatrix: RuntimeControlScopeMatrix = {
    mode: "runtime_control_scope_matrix",
    actualRuntimeOrchestrationEnabled: false,
    actualControlEnabled: false,
    boundaryLevel: runtimeControlBoundarySummary.boundaryLevel,
    allowedMetadataScopes: scopes.allowedMetadataScopes,
    forbiddenControlScopes: scopes.forbiddenControlScopes,
    notesKo: scopes.notesKo,
  };

  return {
    runtimeControlBoundarySummary,
    runtimeControlBoundaryViolationReport: violations,
    runtimeControlScopeMatrix,
  };
}
