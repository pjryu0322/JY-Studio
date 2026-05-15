/**
 * H17 — Overlay semantic 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemantic/runtimeSemanticLabelsKo";

export type OverlayRuntimeSemanticSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  compressionRatioLabel: string;
  semanticGroupRows: readonly Readonly<{ label: string; items: readonly string[] }>[];
  compressedTraceRows: readonly string[];
  stabilizedOrderingRows: readonly string[];
  redundancyNote: string;
}>;

export function buildOverlayRuntimeSemanticSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports
): OverlayRuntimeSemanticSectionVM {
  const { semanticGroupsSummary, compressedReasoningTrace, semanticRedundancySummary, stabilizedSemanticOrdering } =
    reports;

  return {
    sectionDisclaimer: RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO,
    showAttention:
      semanticRedundancySummary.reasoningExplosionRisk !== "low" ||
      semanticRedundancySummary.duplicateOverlaySemanticMappingRisk !== "low" ||
      compressedReasoningTrace.originalItemCount > compressedReasoningTrace.compressedItemCount + 4,
    compressionRatioLabel: semanticGroupsSummary.compressionRatioLabel,
    semanticGroupRows: semanticGroupsSummary.groups.map((g) => ({
      label: g.labelKo,
      items: g.compressedItems,
    })),
    compressedTraceRows: stabilizedSemanticOrdering.orderedCompressedLines.slice(0, 6),
    stabilizedOrderingRows: stabilizedSemanticOrdering.orderedGroupLabels,
    redundancyNote: semanticRedundancySummary.findings[0] ?? "Semantic compression 적용됨.",
  };
}
