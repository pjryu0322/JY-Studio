/**
 * H14.5 — Overlay **unified runtime planning** 요약 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimePlanningConsolidatedSectionVM = Readonly<{
  sectionDisclaimer: string;
  stabilityHeadline: string;
  stabilityDetail: string;
  priorityHeadline: string;
  priorityDetail: string;
  lifecycleHeadline: string;
  lifecycleDetail: string;
  coherenceHeadline: string;
  coherenceDetail: string;
  criticalIssues: readonly string[];
  showAttention: boolean;
}>;

export function buildOverlayRuntimePlanningConsolidatedSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePlanningConsolidatedSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).consolidatedVm;
}
