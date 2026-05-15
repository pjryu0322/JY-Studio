/**
 * H10 — 런타임 **리스크 요약**(read-only 휴리스틱).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeRiskSummaryWire } from "./runtimeTrialTypes";

export function buildRuntimeRiskSummary(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
}): RuntimeRiskSummaryWire {
  const pressure = evaluateResourcePressure(input.extract);
  const factors: string[] = [];

  if (input.releaseGate.readinessLevel === "not_ready") {
    factors.push("Release gate: 미준비");
  } else if (input.releaseGate.readinessLevel === "observe_more") {
    factors.push("Release gate: 추가 관찰");
  } else {
    factors.push("Release gate: 수동 검토 후보");
  }

  if (input.baseline.missingCount > 0) {
    factors.push(`Maturity 누락 계층 ${input.baseline.missingCount}개`);
  }
  if (input.baseline.partialCount > 0) {
    factors.push(`Maturity 부분 계층 ${input.baseline.partialCount}개`);
  }

  factors.push(`자원 압력 심각도: ${pressure.pressureSeverity}`);

  let overallRiskLabelKo = "중간";
  if (
    pressure.pressureSeverity === "critical" ||
    input.releaseGate.readinessLevel === "not_ready" ||
    input.baseline.missingCount > 0
  ) {
    overallRiskLabelKo = "높음";
  } else if (pressure.pressureSeverity === "stable" && input.releaseGate.readinessLevel === "candidate_for_manual_review") {
    overallRiskLabelKo = "낮음~중간";
  }

  return {
    overallRiskLabelKo,
    riskFactors: factors,
    resourcePressureSeverity: pressure.pressureSeverity,
    releaseGateReadinessLevel: input.releaseGate.readinessLevel,
  };
}

/** 진단 API용 직렬화(breaking change 없음). */
export function serializeRuntimeRiskSummaryForDiagnostic(summary: RuntimeRiskSummaryWire): RuntimeRiskSummaryWire {
  return {
    overallRiskLabelKo: summary.overallRiskLabelKo,
    riskFactors: [...summary.riskFactors],
    resourcePressureSeverity: summary.resourcePressureSeverity,
    releaseGateReadinessLevel: summary.releaseGateReadinessLevel,
  };
}
