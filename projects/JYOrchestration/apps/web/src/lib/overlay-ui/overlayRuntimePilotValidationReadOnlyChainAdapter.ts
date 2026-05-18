/**
 * Pilot Validation Phase 0 — Overlay read-only chain validation adapter.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimePilotValidationReadOnlyChainSectionVmFromReports,
  type OverlayRuntimePilotValidationReadOnlyChainSectionVM,
} from "./overlayRuntimePilotValidationReadOnlyChainSectionVm";

export type { OverlayRuntimePilotValidationReadOnlyChainSectionVM } from "./overlayRuntimePilotValidationReadOnlyChainSectionVm";

export function buildOverlayRuntimePilotValidationReadOnlyChainSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePilotValidationReadOnlyChainSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimePilotValidationReadOnlyChainVm;
}

export { buildOverlayRuntimePilotValidationReadOnlyChainSectionVmFromReports };
