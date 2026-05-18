/**
 * H30 — Overlay runner no-op harness VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeRunnerNoopHarnessSectionVM } from "./overlayRuntimeRunnerNoopHarnessSectionVm";

export type { OverlayRuntimeRunnerNoopHarnessSectionVM } from "./overlayRuntimeRunnerNoopHarnessSectionVm";
export { buildOverlayRuntimeRunnerNoopHarnessSectionVmFromReports } from "./overlayRuntimeRunnerNoopHarnessSectionVm";

export function buildOverlayRuntimeRunnerNoopHarnessSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeRunnerNoopHarnessSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeRunnerNoopHarnessVm;
}
