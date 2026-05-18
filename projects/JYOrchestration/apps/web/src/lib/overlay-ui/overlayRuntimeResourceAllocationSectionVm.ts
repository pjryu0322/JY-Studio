/**
 * H21.5 — Overlay runtime resource **allocation planning** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_ALLOCATION_MODE_LABEL_KO,
  RUNTIME_RESOURCE_ALLOCATION_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeResourceAllocation/runtimeResourceAllocationLabelsKo";

export type OverlayRuntimeResourceAllocationSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  globalAllocationModeKo: string;
  eligibilityEffectiveKo: string;
  executionCandidateKo: string;
  governanceBoundaryKo: string;
  providerHintKo: string;
  providerLinkKo: string;
  executionHintKo: string;
  queueBottleneckKo: string;
  memberRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeResourceAllocationSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeResourceAllocationSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const p = reports.runtimeResourceAllocationPlan;
  const e = reports.runtimeAllocationEligibilitySummary;
  const prov = reports.runtimeProviderSlotPlan;
  const ex = reports.runtimeExecutionSlotPlan;

  const memberRows = compactAndNarrowUi
    ? p.memberPlans
        .slice(0, 2)
        .map((m) => `${m.memberId}: ${RUNTIME_ALLOCATION_MODE_LABEL_KO[m.allocationMode]}`)
    : p.memberPlans.map(
        (m) =>
          `${m.memberId} · ${RUNTIME_ALLOCATION_MODE_LABEL_KO[m.allocationMode]} · priority=${m.priorityRank} · ${m.timingHintKo}`
      );
  const recommendationRows = compactAndNarrowUi
    ? p.recommendationRows.slice(0, 1)
    : [...p.recommendationRows].sort((a, b) => a.localeCompare(b, "ko"));

  return {
    sectionDisclaimer: RUNTIME_RESOURCE_ALLOCATION_SECTION_DISCLAIMER_KO,
    showAttention:
      e.effectiveAllocationMode !== "not_needed" ||
      p.globalAllocationMode !== "not_needed" ||
      prov.recommendations.length > 0 ||
      ex.recommendations.length > 0,
    showDetailSections: !compactAndNarrowUi,
    globalAllocationModeKo: RUNTIME_ALLOCATION_MODE_LABEL_KO[p.globalAllocationMode],
    eligibilityEffectiveKo: RUNTIME_ALLOCATION_MODE_LABEL_KO[e.effectiveAllocationMode],
    executionCandidateKo: e.executionCandidateKo,
    governanceBoundaryKo: e.governanceBoundaryLinkKo,
    providerHintKo: prov.providerSlotHintKo,
    providerLinkKo: prov.providerPressureLinkKo,
    executionHintKo: ex.executionSlotHintKo,
    queueBottleneckKo: ex.queueAndBottleneckLinkKo,
    memberRows,
    recommendationRows,
  };
}
