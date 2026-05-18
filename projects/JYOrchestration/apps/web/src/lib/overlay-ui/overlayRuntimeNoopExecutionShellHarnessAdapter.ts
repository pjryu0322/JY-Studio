/**
 * H32 — Overlay controlled execution shell harness adapter.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeNoopExecutionShellHarnessSectionVM } from "./overlayRuntimeNoopExecutionShellHarnessSectionVm";

export type { OverlayRuntimeNoopExecutionShellHarnessSectionVM } from "./overlayRuntimeNoopExecutionShellHarnessSectionVm";
export { buildOverlayRuntimeNoopExecutionShellHarnessSectionVmFromReports } from "./overlayRuntimeNoopExecutionShellHarnessSectionVm";

export function buildOverlayRuntimeNoopExecutionShellHarnessSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeNoopExecutionShellHarnessSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeNoopExecutionShellHarnessVm;
}
