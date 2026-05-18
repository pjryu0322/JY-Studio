/**
 * H16 — Overlay **traceability** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimeTraceabilitySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  reasoningStepRows: readonly Readonly<{ id: string; label: string; explanation: string }>[];
  dependencyTracePaths: readonly string[];
  priorityTracePaths: readonly string[];
  criticalTransitionChains: readonly string[];
}>;

export function buildOverlayRuntimeTraceabilitySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeTraceabilitySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).traceabilityVm;
}
