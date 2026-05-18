/**
 * H15.5 — Overlay **criticality** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimeCriticalitySectionVM = Readonly<{
  sectionDisclaimer: string;
  criticalityScoreLabel: string;
  showAttention: boolean;
  criticalNodes: readonly string[];
  highPriorityNodes: readonly string[];
  priorityPropagationPaths: readonly string[];
  escalationFlowPaths: readonly string[];
  criticalDependencyChains: readonly string[];
}>;

export function buildOverlayRuntimeCriticalitySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeCriticalitySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).criticalityVm;
}
