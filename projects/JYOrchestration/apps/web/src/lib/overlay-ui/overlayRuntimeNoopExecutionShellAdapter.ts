/**
 * H31 — Overlay no-op execution shell VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeNoopExecutionShellSectionVM } from "./overlayRuntimeNoopExecutionShellSectionVm";

export type { OverlayRuntimeNoopExecutionShellSectionVM } from "./overlayRuntimeNoopExecutionShellSectionVm";
export { buildOverlayRuntimeNoopExecutionShellSectionVmFromReports } from "./overlayRuntimeNoopExecutionShellSectionVm";

export function buildOverlayRuntimeNoopExecutionShellSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeNoopExecutionShellSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeNoopExecutionShellVm;
}
