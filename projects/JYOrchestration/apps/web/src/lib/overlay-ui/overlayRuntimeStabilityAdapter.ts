/**
 * H12 — Overlay **runtime stability** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimeStabilitySectionVM = Readonly<{
  sectionDisclaimer: string;
  stabilityLevelLabel: string;
  conflictSeverityLabel: string;
  saturationLevelLabel: string;
  showSaturationBanner: boolean;
  saturationBannerMessage: string;
  conflictRows: readonly Readonly<{ title: string; severityLabel: string; note: string }>[];
  blockedCandidates: readonly string[];
  recommendedCandidates: readonly string[];
  criticalDependencies: readonly string[];
  riskFactors: readonly string[];
  unstableGovernanceNote: string;
  unstableExplainabilityNote: string;
}>;

export function buildOverlayRuntimeStabilitySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeStabilitySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).stabilityVm;
}
