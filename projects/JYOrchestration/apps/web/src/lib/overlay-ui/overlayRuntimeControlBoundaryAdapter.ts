/**
 * H22.5 — Overlay control boundary VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeControlBoundarySectionVM } from "./overlayRuntimeControlBoundarySectionVm";

export type { OverlayRuntimeControlBoundarySectionVM } from "./overlayRuntimeControlBoundarySectionVm";
export { buildOverlayRuntimeControlBoundarySectionVmFromReports } from "./overlayRuntimeControlBoundarySectionVm";

export function buildOverlayRuntimeControlBoundarySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeControlBoundarySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeControlBoundaryVm;
}
