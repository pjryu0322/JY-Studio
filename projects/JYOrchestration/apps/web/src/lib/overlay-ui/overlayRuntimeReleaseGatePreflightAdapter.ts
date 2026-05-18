/**
 * H35 — Overlay runtime release-gate preflight **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import type { OverlayRuntimeReleaseGatePreflightSectionVM } from "./overlayRuntimeReleaseGatePreflightSectionVm";

export type { OverlayRuntimeReleaseGatePreflightSectionVM } from "./overlayRuntimeReleaseGatePreflightSectionVm";
export { buildOverlayRuntimeReleaseGatePreflightSectionVmFromReports } from "./overlayRuntimeReleaseGatePreflightSectionVm";

export function buildOverlayRuntimeReleaseGatePreflightSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeReleaseGatePreflightSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeReleaseGatePreflightVm;
}
