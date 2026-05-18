/**
 * H38 — Overlay runtime governance release-readiness **adapter**.
 */

import { buildOverlayRuntimePlanningSectionVms } from "./overlayRuntimePlanningSectionVms";
import {
  buildOverlayRuntimeGovernanceReleaseReadinessSectionVmFromReports,
  type OverlayRuntimeGovernanceReleaseReadinessSectionVM,
} from "./overlayRuntimeGovernanceReleaseReadinessSectionVm";

export type { OverlayRuntimeGovernanceReleaseReadinessSectionVM } from "./overlayRuntimeGovernanceReleaseReadinessSectionVm";

export function buildOverlayRuntimeGovernanceReleaseReadinessSectionVm(input: {
  readonly overlay: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["overlay"];
  readonly maturityBaseline: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["maturityBaseline"];
  readonly releaseGate: Parameters<typeof buildOverlayRuntimePlanningSectionVms>[0]["releaseGate"];
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeGovernanceReleaseReadinessSectionVM {
  return buildOverlayRuntimePlanningSectionVms(input).runtimeGovernanceReleaseReadinessVm;
}

export { buildOverlayRuntimeGovernanceReleaseReadinessSectionVmFromReports };
