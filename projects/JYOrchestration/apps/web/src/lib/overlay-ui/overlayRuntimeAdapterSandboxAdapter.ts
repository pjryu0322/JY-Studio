/**
 * H26 — Overlay adapter sandbox VM(read-only).
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeAdapterSandboxSectionVM } from "./overlayRuntimeAdapterSandboxSectionVm";

export type { OverlayRuntimeAdapterSandboxSectionVM } from "./overlayRuntimeAdapterSandboxSectionVm";
export { buildOverlayRuntimeAdapterSandboxSectionVmFromReports } from "./overlayRuntimeAdapterSandboxSectionVm";

export function buildOverlayRuntimeAdapterSandboxSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeAdapterSandboxSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeAdapterSandboxVm;
}
