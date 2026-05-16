/**
 * H27 — Overlay pilot activation VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimePilotActivationSectionVM } from "./overlayRuntimePilotActivationSectionVm";

export type { OverlayRuntimePilotActivationSectionVM } from "./overlayRuntimePilotActivationSectionVm";
export { buildOverlayRuntimePilotActivationSectionVmFromReports } from "./overlayRuntimePilotActivationSectionVm";

export function buildOverlayRuntimePilotActivationSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePilotActivationSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimePilotActivationVm;
}
