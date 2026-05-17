/**
 * H34 — Overlay runtime no-op shell release-gate adapter.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeNoopShellReleaseGateSectionVM } from "./overlayRuntimeNoopShellReleaseGateSectionVm";

export type { OverlayRuntimeNoopShellReleaseGateSectionVM } from "./overlayRuntimeNoopShellReleaseGateSectionVm";
export { buildOverlayRuntimeNoopShellReleaseGateSectionVmFromReports } from "./overlayRuntimeNoopShellReleaseGateSectionVm";

export function buildOverlayRuntimeNoopShellReleaseGateSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeNoopShellReleaseGateSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeNoopShellReleaseGateVm;
}
