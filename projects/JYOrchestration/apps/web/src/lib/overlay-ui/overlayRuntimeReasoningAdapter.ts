/**
 * H16.5 — Overlay **reasoning consolidation** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeReasoningSectionVM } from "./overlayRuntimeReasoningSectionVm";

export type { OverlayRuntimeReasoningSectionVM } from "./overlayRuntimeReasoningSectionVm";
export { buildOverlayRuntimeReasoningSectionVmFromReports } from "./overlayRuntimeReasoningSectionVm";

export function buildOverlayRuntimeReasoningSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeReasoningSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).reasoningVm;
}
