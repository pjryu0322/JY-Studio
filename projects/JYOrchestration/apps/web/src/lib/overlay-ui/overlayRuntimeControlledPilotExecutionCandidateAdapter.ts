/**
 * H45 — Overlay runtime controlled pilot execution candidate adapter.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeControlledPilotExecutionCandidateSectionVmFromReports,
  type OverlayRuntimeControlledPilotExecutionCandidateSectionVM,
} from "./overlayRuntimeControlledPilotExecutionCandidateSectionVm";

export type { OverlayRuntimeControlledPilotExecutionCandidateSectionVM } from "./overlayRuntimeControlledPilotExecutionCandidateSectionVm";

export function buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeControlledPilotExecutionCandidateSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeControlledPilotExecutionCandidateVm;
}

export { buildOverlayRuntimeControlledPilotExecutionCandidateSectionVmFromReports };
