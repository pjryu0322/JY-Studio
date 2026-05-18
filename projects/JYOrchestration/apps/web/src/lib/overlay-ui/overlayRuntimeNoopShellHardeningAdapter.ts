/**
 * H32 — Overlay runtime no-op shell hardening adapter.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeNoopShellHardeningSectionVM } from "./overlayRuntimeNoopShellHardeningSectionVm";

export type { OverlayRuntimeNoopShellHardeningSectionVM } from "./overlayRuntimeNoopShellHardeningSectionVm";
export { buildOverlayRuntimeNoopShellHardeningSectionVmFromReports } from "./overlayRuntimeNoopShellHardeningSectionVm";

export function buildOverlayRuntimeNoopShellHardeningSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeNoopShellHardeningSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeNoopShellHardeningVm;
}
