/**
 * H19.5 — Overlay runtime decision 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_DECISION_COHERENCE_LEVEL_LABEL_KO,
  RUNTIME_DECISION_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeDecision/runtimeDecisionLabelsKo";

export type OverlayRuntimeDecisionSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  primaryRecommendationKo: string;
  routingImplicationKo: string;
  coherenceLabel: string;
  snapshotSummaryKo: string;
  lineagePathRows: readonly string[];
  recommendationRows: readonly string[];
}>;

const OVERLAY_MAX_LINEAGE = 5;
const OVERLAY_MAX_LINEAGE_COMPACT = 2;
const OVERLAY_MAX_RECOMMENDATIONS = 4;

export function buildOverlayRuntimeDecisionSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeDecisionSectionVM {
  const {
    runtimeDecisionLineage,
    runtimeRecommendationSummary,
    runtimeDecisionCoherence,
    runtimeDecisionSnapshot,
  } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const maxLineage = compactAndNarrowUi ? OVERLAY_MAX_LINEAGE_COMPACT : OVERLAY_MAX_LINEAGE;

  const hasCritical =
    runtimeRecommendationSummary.recommendations.some((r) => r.severity === "critical_candidate") ||
    runtimeDecisionCoherence.overallLevel === "divergent" ||
    runtimeDecisionLineage.primaryReason?.severity === "critical_candidate";

  return {
    sectionDisclaimer: RUNTIME_DECISION_SECTION_DISCLAIMER_KO,
    showAttention: hasCritical || runtimeDecisionCoherence.overallLevel === "partial",
    showDetailSections: !compactAndNarrowUi,
    primaryRecommendationKo: runtimeRecommendationSummary.primaryRecommendationKo,
    routingImplicationKo: runtimeRecommendationSummary.routingImplicationKo,
    coherenceLabel: RUNTIME_DECISION_COHERENCE_LEVEL_LABEL_KO[runtimeDecisionCoherence.overallLevel],
    snapshotSummaryKo: runtimeDecisionSnapshot.summaryKo,
    lineagePathRows: runtimeDecisionLineage.lineagePaths.slice(0, maxLineage),
    recommendationRows: compactAndNarrowUi
      ? [runtimeRecommendationSummary.primaryRecommendationKo]
      : runtimeRecommendationSummary.recommendations.slice(0, OVERLAY_MAX_RECOMMENDATIONS).map((r) => r.labelKo),
  };
}
