/**
 * H40 — Overlay runtime ultimate governance review **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeUltimateGovernanceReviewSectionVmFromReports,
  type OverlayRuntimeUltimateGovernanceReviewSectionVM,
} from "./overlayRuntimeUltimateGovernanceReviewSectionVm";

export type { OverlayRuntimeUltimateGovernanceReviewSectionVM } from "./overlayRuntimeUltimateGovernanceReviewSectionVm";

export function buildOverlayRuntimeUltimateGovernanceReviewSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeUltimateGovernanceReviewSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeUltimateGovernanceReviewVm;
}

export { buildOverlayRuntimeUltimateGovernanceReviewSectionVmFromReports };
