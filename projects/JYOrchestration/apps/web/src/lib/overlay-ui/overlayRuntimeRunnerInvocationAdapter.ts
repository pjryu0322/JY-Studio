/**
 * H29 — Overlay runner invocation VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeRunnerInvocationSectionVM } from "./overlayRuntimeRunnerInvocationSectionVm";

export type { OverlayRuntimeRunnerInvocationSectionVM } from "./overlayRuntimeRunnerInvocationSectionVm";
export { buildOverlayRuntimeRunnerInvocationSectionVmFromReports } from "./overlayRuntimeRunnerInvocationSectionVm";

export function buildOverlayRuntimeRunnerInvocationSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeRunnerInvocationSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeRunnerInvocationVm;
}
