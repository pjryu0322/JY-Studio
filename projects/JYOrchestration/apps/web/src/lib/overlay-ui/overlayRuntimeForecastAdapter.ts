/**
 * H20 — Overlay **runtime forecasting** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeForecastSectionVM } from "./overlayRuntimeForecastSectionVm";

export type { OverlayRuntimeForecastSectionVM } from "./overlayRuntimeForecastSectionVm";
export { buildOverlayRuntimeForecastSectionVmFromReports } from "./overlayRuntimeForecastSectionVm";

export function buildOverlayRuntimeForecastSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeForecastSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).forecastVm;
}
