/**
 * H19.5 — Overlay **runtime decision intelligence** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeDecisionSectionVM } from "./overlayRuntimeDecisionSectionVm";

export type { OverlayRuntimeDecisionSectionVM } from "./overlayRuntimeDecisionSectionVm";
export { buildOverlayRuntimeDecisionSectionVmFromReports } from "./overlayRuntimeDecisionSectionVm";

export function buildOverlayRuntimeDecisionSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeDecisionSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).decisionVm;
}
