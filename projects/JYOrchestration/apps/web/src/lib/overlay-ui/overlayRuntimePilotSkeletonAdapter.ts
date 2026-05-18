/**
 * H28 — Overlay pilot skeleton VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimePilotSkeletonSectionVM } from "./overlayRuntimePilotSkeletonSectionVm";

export type { OverlayRuntimePilotSkeletonSectionVM } from "./overlayRuntimePilotSkeletonSectionVm";
export { buildOverlayRuntimePilotSkeletonSectionVmFromReports } from "./overlayRuntimePilotSkeletonSectionVm";

export function buildOverlayRuntimePilotSkeletonSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePilotSkeletonSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimePilotSkeletonVm;
}
