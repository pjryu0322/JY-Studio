/**
 * H20.5 — Overlay **runtime resource intelligence** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeResourceSectionVM } from "./overlayRuntimeResourceSectionVm";

export type { OverlayRuntimeResourceSectionVM } from "./overlayRuntimeResourceSectionVm";
export { buildOverlayRuntimeResourceSectionVmFromReports } from "./overlayRuntimeResourceSectionVm";

export function buildOverlayRuntimeResourceSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeResourceSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).resourceVm;
}
