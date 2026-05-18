/**
 * H25 — Overlay no-op adapter VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeNoopAdapterSectionVM } from "./overlayRuntimeNoopAdapterSectionVm";

export type { OverlayRuntimeNoopAdapterSectionVM } from "./overlayRuntimeNoopAdapterSectionVm";
export { buildOverlayRuntimeNoopAdapterSectionVmFromReports } from "./overlayRuntimeNoopAdapterSectionVm";

export function buildOverlayRuntimeNoopAdapterSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeNoopAdapterSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeNoopAdapterVm;
}
