/**
 * H39 — Overlay runtime final release governance gate **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeFinalReleaseGovernanceGateSectionVmFromReports,
  type OverlayRuntimeFinalReleaseGovernanceGateSectionVM,
} from "./overlayRuntimeFinalReleaseGovernanceGateSectionVm";

export type { OverlayRuntimeFinalReleaseGovernanceGateSectionVM } from "./overlayRuntimeFinalReleaseGovernanceGateSectionVm";

export function buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeFinalReleaseGovernanceGateSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeFinalReleaseGovernanceGateVm;
}

export { buildOverlayRuntimeFinalReleaseGovernanceGateSectionVmFromReports };
