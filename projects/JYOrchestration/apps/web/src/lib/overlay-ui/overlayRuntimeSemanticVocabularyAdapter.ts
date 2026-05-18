/**
 * H19 — Overlay **semantic vocabulary** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeSemanticVocabularySectionVM } from "./overlayRuntimeSemanticVocabularySectionVm";

export type { OverlayRuntimeSemanticVocabularySectionVM } from "./overlayRuntimeSemanticVocabularySectionVm";
export { buildOverlayRuntimeSemanticVocabularySectionVmFromReports } from "./overlayRuntimeSemanticVocabularySectionVm";

export function buildOverlayRuntimeSemanticVocabularySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeSemanticVocabularySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).semanticVocabularyVm;
}
