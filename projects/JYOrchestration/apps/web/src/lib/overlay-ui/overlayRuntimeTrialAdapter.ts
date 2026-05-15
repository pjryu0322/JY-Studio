/**
 * H10 — Overlay **통제 런타임 시험 준비** ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeSimulationSummary } from "@/lib/harness/runtimeTrial/buildRuntimeSimulationSummary";
import { evaluateRuntimeTrialReadiness } from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";
import { buildRuntimeRiskSummary } from "@/lib/harness/runtimeTrial/runtimeRiskSummary";
import type { RuntimeTrialReadinessLevel } from "@/lib/harness/runtimeTrial/runtimeTrialTypes";

const READINESS: Record<RuntimeTrialReadinessLevel, string> = {
  not_prepared: "미준비",
  preparation_partial: "부분 준비",
  ready_for_documented_trial: "문서화된 시험 설계 가능(실행 아님)",
};

export type OverlayRuntimeTrialSectionVM = Readonly<{
  sectionDisclaimer: string;
  readinessLevelKey: string;
  readinessLevelLabel: string;
  unstableLayersHeading: string;
  unstableLayerLabelsKo: readonly string[];
  unstableEmptyLabel: string;
  riskOverallLabel: string;
  riskFactors: readonly string[];
  simulationDisclaimer: string;
  simulatedActionLabels: readonly string[];
}>;

export function buildOverlayRuntimeTrialSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
}): OverlayRuntimeTrialSectionVM {
  const trial = evaluateRuntimeTrialReadiness({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });
  const risk = buildRuntimeRiskSummary({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });
  const sim = buildRuntimeSimulationSummary();

  return {
    sectionDisclaimer:
      "H10 — 통제 런타임 시험 **준비** 정보입니다. 실제 오케스트레이션·라우팅·강제는 수행되지 않습니다.",
    readinessLevelKey: trial.readinessLevel,
    readinessLevelLabel: READINESS[trial.readinessLevel],
    unstableLayersHeading: "불안정·미완 maturity 계층(관측)",
    unstableLayerLabelsKo: trial.unstableLayerLabelsKo,
    unstableEmptyLabel: "불안정으로 표시된 계층이 없습니다.",
    riskOverallLabel: risk.overallRiskLabelKo,
    riskFactors: risk.riskFactors,
    simulationDisclaimer: sim.disclaimerKo,
    simulatedActionLabels: sim.simulatedActions.map((a) => a.labelKo),
  };
}
