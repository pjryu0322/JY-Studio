/**
 * H14 — Overlay **runtime coherence** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimeCoherenceSectionVM = Readonly<{
  sectionDisclaimer: string;
  coherenceLabel: string;
  synchronizationLabel: string;
  divergenceSeverityLabel: string;
  alignmentScoreLabel: string;
  operatorAttentionRequired: boolean;
  misalignedAreas: readonly string[];
  laggingLayers: readonly string[];
  staleConsistencyIssues: readonly string[];
  divergenceAreas: readonly string[];
  divergenceReasons: readonly string[];
}>;

export function buildOverlayRuntimeCoherenceSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeCoherenceSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).coherenceVm;
}
