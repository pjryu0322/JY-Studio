/**
 * H13.5 — Overlay **runtime lifecycle** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimeLifecycleSectionVM = Readonly<{
  sectionDisclaimer: string;
  freshnessLabel: string;
  lifecycleStateLabel: string;
  driftSeverityLabel: string;
  showStaleLifecycleBanner: boolean;
  staleLifecycleBannerMessage: string;
  agingFactors: readonly string[];
  staleFactors: readonly string[];
  driftAreas: readonly string[];
  driftReasons: readonly string[];
  invalidationCandidates: readonly string[];
  staleDependencies: readonly string[];
  stalePlanningAreas: readonly string[];
}>;

export function buildOverlayRuntimeLifecycleSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeLifecycleSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).lifecycleVm;
}
