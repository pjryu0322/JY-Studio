/**
 * H18 — Overlay semantic graph 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_SEMANTIC_EXPLOSION_RISK_LABEL_KO,
  RUNTIME_SEMANTIC_GRAPH_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeSemanticGraph/runtimeSemanticGraphLabelsKo";

export type OverlayRuntimeSemanticGraphSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  explosionRiskLabel: string;
  primaryOriginChainLabel: string;
  causalPathRows: readonly string[];
  warningOriginRows: readonly string[];
}>;

const OVERLAY_MAX_VISIBLE_CAUSAL_PATHS = 5;

export function buildOverlayRuntimeSemanticGraphSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeSemanticGraphSectionVM {
  const {
    semanticExplainabilityGraph,
    semanticWarningOriginSummary,
    semanticExplosionRiskSummary,
    compressionQualityReport,
  } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const hasWarning =
    compressionQualityReport.quality !== "safe" ||
    semanticExplosionRiskSummary.explosionRisk !== "low" ||
    semanticWarningOriginSummary.origins.some((o) => o.severity === "warning");

  const causalPathRows = semanticExplainabilityGraph.causalPaths.slice(0, OVERLAY_MAX_VISIBLE_CAUSAL_PATHS);

  return {
    sectionDisclaimer: RUNTIME_SEMANTIC_GRAPH_SECTION_DISCLAIMER_KO,
    showAttention: hasWarning || semanticWarningOriginSummary.origins.length >= 2,
    showDetailSections: !compactAndNarrowUi,
    explosionRiskLabel: RUNTIME_SEMANTIC_EXPLOSION_RISK_LABEL_KO[semanticExplosionRiskSummary.explosionRisk],
    primaryOriginChainLabel: semanticWarningOriginSummary.primaryOriginChain.join(" → ") || "—",
    causalPathRows,
    warningOriginRows: semanticWarningOriginSummary.origins
      .slice(0, 4)
      .map((o) => `${o.warningCode}: ${o.originChain.join(" → ")}`),
  };
}
