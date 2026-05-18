/**
 * H17 — Overlay **semantic compression** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeSemanticSectionVM } from "./overlayRuntimeSemanticSectionVm";

export type { OverlayRuntimeSemanticSectionVM } from "./overlayRuntimeSemanticSectionVm";
export { buildOverlayRuntimeSemanticSectionVmFromReports } from "./overlayRuntimeSemanticSectionVm";

export function buildOverlayRuntimeSemanticSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeSemanticSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).semanticVm;
}
