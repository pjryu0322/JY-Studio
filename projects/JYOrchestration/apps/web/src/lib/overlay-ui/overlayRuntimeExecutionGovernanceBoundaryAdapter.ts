/**
 * H37 — Overlay runtime execution governance boundary section VM adapter.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeExecutionGovernanceBoundarySectionVmFromReports,
  type OverlayRuntimeExecutionGovernanceBoundarySectionVM,
} from "./overlayRuntimeExecutionGovernanceBoundarySectionVm";

export type { OverlayRuntimeExecutionGovernanceBoundarySectionVM } from "./overlayRuntimeExecutionGovernanceBoundarySectionVm";

export function buildOverlayRuntimeExecutionGovernanceBoundarySectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeExecutionGovernanceBoundarySectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeExecutionGovernanceBoundaryVm;
}

export { buildOverlayRuntimeExecutionGovernanceBoundarySectionVmFromReports };
