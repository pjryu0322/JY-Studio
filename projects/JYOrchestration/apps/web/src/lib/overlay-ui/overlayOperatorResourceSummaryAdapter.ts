/**
 * H9.5 — 운영자 **자원·과밀** 한눈 요약(read-only).
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { OverlayUiSummaryHeaderVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { buildOverlayOperatorRuntimeSummaryVm } from "@/lib/overlay-ui/overlayOperatorRuntimeSummaryAdapter";
import { summarizeOverlayOverloadMitigation, overlayOverloadRiskLabelKo } from "@/lib/overlay-ui/overlayOverloadMitigation";

const SEVERITY: Record<string, string> = {
  stable: "안정",
  elevated: "상승",
  high: "높음",
  critical: "매우 높음",
};

function concentrationLabel(warnings: number, blocks: number): string {
  if (warnings >= 8 || (warnings >= 4 && blocks >= 6)) return "집중(다수 경고+다계층 planning)";
  if (warnings >= 4) return "중간(경고 다발)";
  if (blocks >= 6) return "중간(planning 블록 다수)";
  return "분산";
}

function memoryPressureLabel(refs: number): string {
  if (refs >= 12) return "높음";
  if (refs >= 5) return "중간";
  return "낮음";
}

function reviewPressureLabel(items: number): string {
  if (items >= 14) return "높음";
  if (items >= 6) return "중간";
  return "낮음";
}

function formatExplainabilityNoiseLevel(signals: number, warnings: number): string {
  const s = signals + warnings;
  if (s >= 14) return "높음";
  if (s >= 7) return "중간";
  return "낮음";
}

export type OverlayOperatorResourceSummaryVM = Readonly<{
  pressureSeverityKey: string;
  pressureSeverityLabel: string;
  compositeScoreLabel: string;
  overloadRiskLabel: string;
  explainabilityNoiseLabel: string;
  warningConcentrationLabel: string;
  memoryPressureLabel: string;
  reviewPressureLabel: string;
  mitigationHintSample: string;
}>;

export function buildOverlayOperatorResourceSummaryVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly summary: OverlayUiSummaryHeaderVM;
  readonly compactAndNarrowUi?: boolean;
}): OverlayOperatorResourceSummaryVM {
  const ev = evaluateResourcePressure(input.overlay);
  const overload = summarizeOverlayOverloadMitigation({
    extract: input.overlay,
    compactAndNarrowUi: input.compactAndNarrowUi ?? false,
  });

  const overloadRiskKo = overlayOverloadRiskLabelKo(overload.overlayOverloadRisk);

  const hint0 = overload.mitigationHints[0] ?? "";

  return {
    pressureSeverityKey: ev.pressureSeverity,
    pressureSeverityLabel: SEVERITY[ev.pressureSeverity] ?? ev.pressureSeverity,
    compositeScoreLabel: `${ev.compositeScore}점(H9 압력 ${ev.h9Pressure.score})`,
    overloadRiskLabel: overloadRiskKo,
    explainabilityNoiseLabel: formatExplainabilityNoiseLevel(ev.explainabilitySignalCount, ev.warningCount),
    warningConcentrationLabel: concentrationLabel(input.summary.warningCount, ev.overlaySectionCount),
    memoryPressureLabel: memoryPressureLabel(ev.memoryRefCount),
    reviewPressureLabel: reviewPressureLabel(ev.reviewItemCount),
    mitigationHintSample: hint0,
  };
}

/** `GET /api/diagnostics/overlay-runtime` 등 JSON 직렬화용(비밀·payload 없음). */
export function serializeOperatorRuntimeSummaryForDiagnostic(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly summary: OverlayUiSummaryHeaderVM;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
}): Readonly<Record<string, unknown>> {
  const base = buildOverlayOperatorResourceSummaryVm({
    overlay: input.overlay,
    summary: input.summary,
  });
  const h85 = buildOverlayOperatorRuntimeSummaryVm({
    overlay: input.overlay,
    summary: input.summary,
    maturityBaseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  return {
    maturityOverallLabel: h85.maturityOverallLabel,
    releaseGateLabel: h85.releaseGateLabel,
    warningCountLabel: h85.warningCountLabel,
    executionSafetyStatusLabel: h85.executionSafetyStatusLabel,
    reviewSecurityLabel: h85.reviewSecurityLabel,
    explainabilitySurfaceLabel: h85.explainabilitySurfaceLabel,
    maturityOverallStatus: input.maturityBaseline.overallStatus,
    releaseGateReadinessLevel: input.releaseGate.readinessLevel,
    warningCount: input.summary.warningCount,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    resourcePressureSeverity: base.pressureSeverityKey,
    resourcePressureSeverityLabel: base.pressureSeverityLabel,
    compositeScoreLabel: base.compositeScoreLabel,
    overloadRiskLabel: base.overloadRiskLabel,
    explainabilityNoiseLabel: base.explainabilityNoiseLabel,
    warningConcentrationLabel: base.warningConcentrationLabel,
    memoryPressureLabel: base.memoryPressureLabel,
    reviewPressureLabel: base.reviewPressureLabel,
    mitigationHintSample: base.mitigationHintSample,
  };
}
