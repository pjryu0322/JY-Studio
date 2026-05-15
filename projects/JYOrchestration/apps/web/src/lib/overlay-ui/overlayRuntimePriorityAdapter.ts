/**
 * H12.5 — Overlay **runtime priority** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";

export type OverlayRuntimePrioritySectionVM = Readonly<{
  sectionDisclaimer: string;
  overallPlanningPriorityLabel: string;
  escalationLevelLabel: string;
  showEscalationBadge: boolean;
  operatorAttentionRequired: boolean;
  operatorAttentionLabel: string;
  dependencyRows: readonly Readonly<{ title: string; priorityLabel: string; status: string; note: string }>[];
  bottleneckRows: readonly Readonly<{ title: string; priorityLabel: string; note: string }>[];
  criticalDependencies: readonly string[];
  dependencyCycles: readonly string[];
  escalationReasons: readonly string[];
}>;

export function buildOverlayRuntimePrioritySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePrioritySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).priorityVm;
}
