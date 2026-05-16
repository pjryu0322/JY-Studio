/**
 * H21.5 — Overlay resource allocation planning VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeResourceAllocationSectionVM } from "./overlayRuntimeResourceAllocationSectionVm";

export type { OverlayRuntimeResourceAllocationSectionVM } from "./overlayRuntimeResourceAllocationSectionVm";
export { buildOverlayRuntimeResourceAllocationSectionVmFromReports } from "./overlayRuntimeResourceAllocationSectionVm";

export function buildOverlayRuntimeResourceAllocationSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeResourceAllocationSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).resourceAllocationVm;
}
