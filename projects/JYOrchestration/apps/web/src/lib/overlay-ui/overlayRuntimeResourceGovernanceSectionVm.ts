/**
 * H21 — Overlay runtime resource **governance** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RESOURCE_ALLOCATION_READINESS_LABEL_KO,
  RUNTIME_RESOURCE_GOVERNANCE_MODE_LABEL_KO,
  RUNTIME_RESOURCE_GOVERNANCE_RISK_LABEL_KO,
  RUNTIME_RESOURCE_GOVERNANCE_SECTION_DISCLAIMER_KO,
  RUNTIME_RESOURCE_OPERATOR_REVIEW_LABEL_KO,
} from "@/lib/harness/runtimeResourceGovernance/runtimeResourceGovernanceLabelsKo";

export type OverlayRuntimeResourceGovernanceSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  governanceRiskKo: string;
  governanceModeKo: string;
  operatorReviewKo: string;
  controlBoundaryKo: string;
  allocationReadinessKo: string;
  policyViolationKo: string;
  findingRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeResourceGovernanceSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeResourceGovernanceSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeResourceGovernanceSummary;
  const b = reports.runtimeResourceControlBoundary;

  const findingRows = compactAndNarrowUi
    ? s.policyFindings.slice(0, 1)
    : [...s.policyFindings].sort((a, b) => a.localeCompare(b));
  const recommendationRows = compactAndNarrowUi
    ? s.recommendations.slice(0, 1)
    : [...s.recommendations].sort((a, b) => a.localeCompare(b));

  return {
    sectionDisclaimer: RUNTIME_RESOURCE_GOVERNANCE_SECTION_DISCLAIMER_KO,
    showAttention:
      s.governanceRisk !== "stable" ||
      s.operatorReviewRequirement !== "not_required" ||
      s.governanceMode !== "observe_only",
    showDetailSections: !compactAndNarrowUi,
    governanceRiskKo: RUNTIME_RESOURCE_GOVERNANCE_RISK_LABEL_KO[s.governanceRisk],
    governanceModeKo: RUNTIME_RESOURCE_GOVERNANCE_MODE_LABEL_KO[s.governanceMode],
    operatorReviewKo: RUNTIME_RESOURCE_OPERATOR_REVIEW_LABEL_KO[s.operatorReviewRequirement],
    controlBoundaryKo: `${RUNTIME_RESOURCE_GOVERNANCE_MODE_LABEL_KO[b.boundary]} — ${b.rationaleKo}`,
    allocationReadinessKo: RUNTIME_RESOURCE_ALLOCATION_READINESS_LABEL_KO[s.allocationReadiness],
    policyViolationKo: `${s.policyViolationCandidate.summaryKo} (risk=${s.policyViolationCandidate.risk})`,
    findingRows,
    recommendationRows,
  };
}
