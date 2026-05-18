/**
 * H24.5 — Overlay pilot contract VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimePilotContractSectionVM } from "./overlayRuntimePilotContractSectionVm";

export type { OverlayRuntimePilotContractSectionVM } from "./overlayRuntimePilotContractSectionVm";
export { buildOverlayRuntimePilotContractSectionVmFromReports } from "./overlayRuntimePilotContractSectionVm";

export function buildOverlayRuntimePilotContractSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePilotContractSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimePilotContractVm;
}
