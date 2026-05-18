/**
 * H43 — Overlay runtime limited pilot readiness review **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeLimitedPilotReadinessReviewSectionVmFromReports,
  type OverlayRuntimeLimitedPilotReadinessReviewSectionVM,
} from "./overlayRuntimeLimitedPilotReadinessReviewSectionVm";

export type { OverlayRuntimeLimitedPilotReadinessReviewSectionVM } from "./overlayRuntimeLimitedPilotReadinessReviewSectionVm";

export function buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeLimitedPilotReadinessReviewSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeLimitedPilotReadinessReviewVm;
}

export { buildOverlayRuntimeLimitedPilotReadinessReviewSectionVmFromReports };
