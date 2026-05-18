/**
 * H23.5 — Overlay operator approval·rollback·audit readiness VM(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeOperatorApprovalSectionVM } from "./overlayRuntimeOperatorApprovalSectionVm";

export type { OverlayRuntimeOperatorApprovalSectionVM } from "./overlayRuntimeOperatorApprovalSectionVm";
export { buildOverlayRuntimeOperatorApprovalSectionVmFromReports } from "./overlayRuntimeOperatorApprovalSectionVm";

export function buildOverlayRuntimeOperatorApprovalSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeOperatorApprovalSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeOperatorApprovalVm;
}
