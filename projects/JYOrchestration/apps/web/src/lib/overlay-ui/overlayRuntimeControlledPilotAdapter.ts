/**
 * H24 — Overlay controlled pilot VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeControlledPilotSectionVM } from "./overlayRuntimeControlledPilotSectionVm";

export type { OverlayRuntimeControlledPilotSectionVM } from "./overlayRuntimeControlledPilotSectionVm";
export { buildOverlayRuntimeControlledPilotSectionVmFromReports } from "./overlayRuntimeControlledPilotSectionVm";

export function buildOverlayRuntimeControlledPilotSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeControlledPilotSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeControlledPilotVm;
}
