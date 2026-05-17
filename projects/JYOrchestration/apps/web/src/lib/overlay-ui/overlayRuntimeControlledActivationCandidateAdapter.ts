/**
 * H41 — Overlay runtime controlled activation candidate **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeControlledActivationCandidateSectionVmFromReports,
  type OverlayRuntimeControlledActivationCandidateSectionVM,
} from "./overlayRuntimeControlledActivationCandidateSectionVm";

export type { OverlayRuntimeControlledActivationCandidateSectionVM } from "./overlayRuntimeControlledActivationCandidateSectionVm";

export function buildOverlayRuntimeControlledActivationCandidateSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeControlledActivationCandidateSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeControlledActivationCandidateVm;
}

export { buildOverlayRuntimeControlledActivationCandidateSectionVmFromReports };
