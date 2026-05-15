/**
 * H17–H17.5 — Overlay semantic 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_SEMANTIC_COMPRESSION_QUALITY_LABEL_KO,
  RUNTIME_SEMANTIC_GROUP_BALANCE_LABEL_KO,
  RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeSemantic/runtimeSemanticLabelsKo";

export type OverlayRuntimeSemanticSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showOverCompressionWarning: boolean;
  showDetailSections: boolean;
  compressionRatioLabel: string;
  qualityLabel: string;
  hiddenTraceCountLabel: string;
  hiddenCriticalCountLabel: string;
  preservedCriticalCountLabel: string;
  groupBalanceLabel: string;
  semanticGroupRows: readonly Readonly<{ label: string; items: readonly string[] }>[];
  compressedTraceRows: readonly string[];
  stabilizedOrderingRows: readonly string[];
  groupBalanceRows: readonly string[];
  hiddenAuditSummaryRows: readonly string[];
  redundancyNote: string;
}>;

export function buildOverlayRuntimeSemanticSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeSemanticSectionVM {
  const {
    semanticGroupsSummary,
    compressedReasoningTrace,
    semanticRedundancySummary,
    stabilizedSemanticOrdering,
    compressionQualityReport,
    hiddenTraceAudit,
    semanticGroupBalanceSummary,
  } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;

  const qualityLabel = RUNTIME_SEMANTIC_COMPRESSION_QUALITY_LABEL_KO[compressionQualityReport.quality];
  const groupBalanceLabel =
    RUNTIME_SEMANTIC_GROUP_BALANCE_LABEL_KO[semanticGroupBalanceSummary.balanceLevel];

  const hiddenAuditSummaryRows = hiddenTraceAudit.findings
    .slice(0, 4)
    .map((f) => f.messageKo);

  const groupBalanceRows = [
    `분포: ${groupBalanceLabel}`,
    semanticGroupBalanceSummary.dominantGroupKind !== "none"
      ? `주요 group: ${semanticGroupBalanceSummary.dominantGroupKind}`
      : "주요 group: —",
    semanticGroupBalanceSummary.otherGroupSharePercent > 0
      ? `other 비중: ${semanticGroupBalanceSummary.otherGroupSharePercent}%`
      : null,
    ...semanticGroupBalanceSummary.findings.slice(0, 2).map((f) => f.messageKo),
  ].filter((x): x is string => Boolean(x));

  return {
    sectionDisclaimer: RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO,
    showAttention:
      compressionQualityReport.quality === "over_compressed" ||
      compressionQualityReport.quality === "watch" ||
      compressionQualityReport.hiddenCriticalSignalCount > 0 ||
      semanticRedundancySummary.reasoningExplosionRisk !== "low" ||
      semanticGroupBalanceSummary.balanceLevel === "imbalanced",
    showOverCompressionWarning: compressionQualityReport.quality === "over_compressed",
    showDetailSections: !compactAndNarrowUi,
    compressionRatioLabel: semanticGroupsSummary.compressionRatioLabel,
    qualityLabel,
    hiddenTraceCountLabel: `${hiddenTraceAudit.hiddenTraceCount}건`,
    hiddenCriticalCountLabel: `${compressionQualityReport.hiddenCriticalSignalCount}건`,
    preservedCriticalCountLabel: `${compressionQualityReport.preservedCriticalSignalCount}건`,
    groupBalanceLabel,
    semanticGroupRows: semanticGroupsSummary.groups.map((g) => ({
      label: g.labelKo,
      items: g.compressedItems,
    })),
    compressedTraceRows: stabilizedSemanticOrdering.orderedCompressedLines.slice(0, 6),
    stabilizedOrderingRows: stabilizedSemanticOrdering.orderedGroupLabels,
    groupBalanceRows: groupBalanceRows.slice(0, 4),
    hiddenAuditSummaryRows,
    redundancyNote: semanticRedundancySummary.findings[0] ?? "Semantic compression 적용됨.",
  };
}
