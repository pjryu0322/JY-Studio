/**
 * H22 — Overlay resource allocation trial VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeResourceTrialSectionVM } from "./overlayRuntimeResourceTrialSectionVm";

export type { OverlayRuntimeResourceTrialSectionVM } from "./overlayRuntimeResourceTrialSectionVm";
export { buildOverlayRuntimeResourceTrialSectionVmFromReports } from "./overlayRuntimeResourceTrialSectionVm";

export function buildOverlayRuntimeResourceTrialSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeResourceTrialSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).resourceTrialVm;
}
