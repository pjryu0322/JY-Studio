/**
 * H18.5 — Overlay semantic narrative 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_SEMANTIC_NARRATIVE_SECTION_DISCLAIMER_KO,
  RUNTIME_SEMANTIC_NARRATIVE_SEVERITY_LABEL_KO,
} from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeLabelsKo";

export type OverlayRuntimeSemanticNarrativeSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  topNarrativeKo: string;
  criticalPathLabel: string;
  warningCollapseLabel: string;
  narrativeRows: readonly Readonly<{ severityLabel: string; text: string }>[];
  rootCauseRows: readonly string[];
}>;

const OVERLAY_MAX_NARRATIVES = 5;
const OVERLAY_MAX_NARRATIVES_COMPACT = 2;
const OVERLAY_MAX_ROOT_CAUSES = 4;

export function buildOverlayRuntimeSemanticNarrativeSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeSemanticNarrativeSectionVM {
  const { semanticNarrativeSummary, semanticRootCauseGroups, semanticGraphRelevanceSummary } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const maxNarratives = compactAndNarrowUi ? OVERLAY_MAX_NARRATIVES_COMPACT : OVERLAY_MAX_NARRATIVES;

  const hasCritical = semanticNarrativeSummary.narratives.some(
    (n) => n.severity === "critical_candidate" || n.severity === "watch"
  );

  const narrativeRows = semanticNarrativeSummary.narratives.slice(0, maxNarratives).map((n) => ({
    severityLabel: RUNTIME_SEMANTIC_NARRATIVE_SEVERITY_LABEL_KO[n.severity],
    text: n.narrativeKo,
  }));

  const rootCauseRows = semanticRootCauseGroups.slice(0, OVERLAY_MAX_ROOT_CAUSES).map(
    (g) =>
      `${g.labelKo}: ${g.primaryChain.join(" → ")}` +
      (g.collapsedWarningCount > 0 ? ` (중복 ${g.collapsedWarningCount}건 접힘)` : "")
  );

  return {
    sectionDisclaimer: RUNTIME_SEMANTIC_NARRATIVE_SECTION_DISCLAIMER_KO,
    showAttention:
      hasCritical ||
      semanticNarrativeSummary.collapsedDuplicateWarnings > 0 ||
      semanticGraphRelevanceSummary.rankedPaths.some((r) => r.severity === "critical_candidate"),
    showDetailSections: !compactAndNarrowUi,
    topNarrativeKo: semanticNarrativeSummary.topNarrativeKo,
    criticalPathLabel: semanticGraphRelevanceSummary.criticalPath,
    warningCollapseLabel: semanticGraphRelevanceSummary.warningCollapseSummaryKo,
    narrativeRows,
    rootCauseRows,
  };
}
