/**
 * H18.5 — Overlay **semantic narrative** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeSemanticNarrativeSectionVM } from "./overlayRuntimeSemanticNarrativeSectionVm";

export type { OverlayRuntimeSemanticNarrativeSectionVM } from "./overlayRuntimeSemanticNarrativeSectionVm";
export { buildOverlayRuntimeSemanticNarrativeSectionVmFromReports } from "./overlayRuntimeSemanticNarrativeSectionVm";

export function buildOverlayRuntimeSemanticNarrativeSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeSemanticNarrativeSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).semanticNarrativeVm;
}
