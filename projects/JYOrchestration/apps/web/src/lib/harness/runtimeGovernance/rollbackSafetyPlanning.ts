/**
 * H10.5 — Rollback **안전 계획** 메타데이터(read-only). 실제 rollback 없음.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeTrialReadinessReport } from "@/lib/harness/runtimeTrial/runtimeTrialTypes";
import type { RollbackSafetyPlanningReport, RollbackSafetyRiskLevel } from "./runtimeGovernanceTypes";

export function buildRollbackSafetyPlanning(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly trialReadiness: RuntimeTrialReadinessReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
}): RollbackSafetyPlanningReport {
  const pressure = evaluateResourcePressure(input.extract);
  const factors: string[] = [];

  let rollbackRisk: RollbackSafetyRiskLevel = "stable";

  if (input.releaseGate.readinessLevel === "not_ready") {
    factors.push("Release gate가 미준비 상태입니다. 롤백 시나리오 문서화 전 운영 리스크를 점검하세요.");
    rollbackRisk = "high";
  }
  if (input.trialReadiness.readinessLevel === "not_prepared") {
    factors.push("통제 시험 준비도가 낮아 롤백 대비 계획만 가능합니다.");
    rollbackRisk = "high";
  }
  if (input.baseline.missingCount > 0) {
    factors.push(`Maturity 누락 계층 ${input.baseline.missingCount}개가 있어 상태 복원 기준점이 불명확할 수 있습니다.`);
    if (rollbackRisk === "stable") rollbackRisk = "watch";
  }
  if (pressure.pressureSeverity === "critical") {
    factors.push("자원 압력이 매우 높습니다. 롤백 절차 검증은 dry-run·문서 수준으로 제한하는 것을 권장합니다.");
    rollbackRisk = "high";
  } else if (pressure.pressureSeverity === "high" || pressure.pressureSeverity === "elevated") {
    factors.push("자원 압력이 상승했습니다. 롤백 시 부하·순서를 사전에 시뮬레이션하세요.");
    if (rollbackRisk === "stable") rollbackRisk = "watch";
  }

  if (factors.length === 0) {
    factors.push("관측 범위에서 치명적 차단 요인은 없습니다. 문서화된 통제 절차 하에서 계획만 수행하세요.");
  }

  return {
    mode: "rollback_safety_planning_only",
    actualRollbackExecutionEnabled: false,
    rollbackRisk,
    factorsKo: factors.slice(0, 6),
  };
}

export function serializeRollbackSafetyPlanningForDiagnostic(
  report: RollbackSafetyPlanningReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRollbackExecutionEnabled: report.actualRollbackExecutionEnabled,
    rollbackRisk: report.rollbackRisk,
    factorsKo: [...report.factorsKo],
  };
}
