/**
 * H36 — Overlay runtime execution boundary shell section VM adapter.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeExecutionBoundaryShellSectionVmFromReports,
  type OverlayRuntimeExecutionBoundaryShellSectionVM,
} from "./overlayRuntimeExecutionBoundaryShellSectionVm";

export type { OverlayRuntimeExecutionBoundaryShellSectionVM } from "./overlayRuntimeExecutionBoundaryShellSectionVm";

export function buildOverlayRuntimeExecutionBoundaryShellSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeExecutionBoundaryShellSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeExecutionBoundaryShellVm;
}

export { buildOverlayRuntimeExecutionBoundaryShellSectionVmFromReports };
