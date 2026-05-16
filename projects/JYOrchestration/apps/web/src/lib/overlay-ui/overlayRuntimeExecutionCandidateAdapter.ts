/**
 * H23 — Overlay execution candidate VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeExecutionCandidateSectionVM } from "./overlayRuntimeExecutionCandidateSectionVm";

export type { OverlayRuntimeExecutionCandidateSectionVM } from "./overlayRuntimeExecutionCandidateSectionVm";
export { buildOverlayRuntimeExecutionCandidateSectionVmFromReports } from "./overlayRuntimeExecutionCandidateSectionVm";

export function buildOverlayRuntimeExecutionCandidateSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeExecutionCandidateSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeExecutionCandidateVm;
}
