/**
 * H42 / H42.5 — Overlay runtime limited pilot boundary **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeLimitedPilotBoundarySectionVmFromReports,
  type OverlayRuntimeLimitedPilotBoundarySectionVM,
} from "./overlayRuntimeLimitedPilotBoundarySectionVm";

export type { OverlayRuntimeLimitedPilotBoundarySectionVM } from "./overlayRuntimeLimitedPilotBoundarySectionVm";

export function buildOverlayRuntimeLimitedPilotBoundarySectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeLimitedPilotBoundarySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeLimitedPilotBoundaryVm;
}

export { buildOverlayRuntimeLimitedPilotBoundarySectionVmFromReports };
