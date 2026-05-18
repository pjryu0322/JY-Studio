/**
 * H21 — Overlay resource governance VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeResourceGovernanceSectionVM } from "./overlayRuntimeResourceGovernanceSectionVm";

export type { OverlayRuntimeResourceGovernanceSectionVM } from "./overlayRuntimeResourceGovernanceSectionVm";
export { buildOverlayRuntimeResourceGovernanceSectionVmFromReports } from "./overlayRuntimeResourceGovernanceSectionVm";

export function buildOverlayRuntimeResourceGovernanceSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeResourceGovernanceSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).resourceGovernanceVm;
}
