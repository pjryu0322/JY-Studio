/**
 * H18 — Overlay **semantic explainability graph** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeSemanticGraphSectionVM } from "./overlayRuntimeSemanticGraphSectionVm";

export type { OverlayRuntimeSemanticGraphSectionVM } from "./overlayRuntimeSemanticGraphSectionVm";
export { buildOverlayRuntimeSemanticGraphSectionVmFromReports } from "./overlayRuntimeSemanticGraphSectionVm";

export function buildOverlayRuntimeSemanticGraphSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeSemanticGraphSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).semanticGraphVm;
}
