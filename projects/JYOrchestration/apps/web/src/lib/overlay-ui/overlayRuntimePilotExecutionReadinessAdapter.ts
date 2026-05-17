/**
 * H44 — Overlay runtime pilot execution readiness adapter.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimePilotExecutionReadinessSectionVmFromReports,
  type OverlayRuntimePilotExecutionReadinessSectionVM,
} from "./overlayRuntimePilotExecutionReadinessSectionVm";

export type { OverlayRuntimePilotExecutionReadinessSectionVM } from "./overlayRuntimePilotExecutionReadinessSectionVm";

export function buildOverlayRuntimePilotExecutionReadinessSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePilotExecutionReadinessSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimePilotExecutionReadinessVm;
}

export { buildOverlayRuntimePilotExecutionReadinessSectionVmFromReports };
