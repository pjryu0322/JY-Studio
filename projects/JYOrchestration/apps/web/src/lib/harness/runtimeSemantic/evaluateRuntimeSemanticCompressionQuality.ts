/**
 * H17.5 — semantic compression **quality** 평가(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type {
  CompressedRuntimeReasoningTrace,
  RuntimeSemanticGroupsSummary,
  RuntimeSemanticRedundancySummary,
  StabilizedRuntimeSemanticOrdering,
} from "./runtimeSemanticTypes";
import type {
  RuntimeHiddenSemanticTraceAudit,
  RuntimeSemanticAuditFinding,
  RuntimeSemanticCompressionQuality,
  RuntimeSemanticCompressionQualityReport,
} from "./runtimeSemanticQualityTypes";
import { collectRawReasoningTraceItems } from "./runtimeSemanticTraceCollect";

export type EvaluateRuntimeSemanticCompressionQualityInput = Readonly<{
  reasoningReports: RuntimeReasoningPlanningReports;
  semanticGroupsSummary: RuntimeSemanticGroupsSummary;
  compressedReasoningTrace: CompressedRuntimeReasoningTrace;
  semanticRedundancySummary: RuntimeSemanticRedundancySummary;
  stabilizedSemanticOrdering: StabilizedRuntimeSemanticOrdering;
  hiddenTraceAudit: RuntimeHiddenSemanticTraceAudit;
}>;

export function evaluateRuntimeSemanticCompressionQuality(
  input: EvaluateRuntimeSemanticCompressionQualityInput
): RuntimeSemanticCompressionQualityReport {
  const {
    reasoningReports,
    semanticGroupsSummary,
    compressedReasoningTrace,
    semanticRedundancySummary,
    stabilizedSemanticOrdering,
    hiddenTraceAudit,
  } = input;

  const visibleTraceCount = compressedReasoningTrace.compressedItemCount;
  const hiddenTraceCount = hiddenTraceAudit.hiddenTraceCount;
  const hiddenCriticalSignalCount = hiddenTraceAudit.hiddenCriticalTransitionCount;

  const criticalGroups = semanticGroupsSummary.groups.filter((g) => g.kind === "criticality");
  const preservedCriticalSignalCount =
    criticalGroups.reduce((n, g) => n + g.compressedItems.length, 0) +
    reasoningReports.unifiedReasoningChain.criticalTransitions.filter((t) =>
      compressedReasoningTrace.compressedLines.some((l) => l.toLowerCase().includes(t.slice(0, 12).toLowerCase()))
    ).length;

  const reductionRatio =
    compressedReasoningTrace.originalItemCount > 0
      ? 1 - visibleTraceCount / compressedReasoningTrace.originalItemCount
      : 0;

  const findings: RuntimeSemanticAuditFinding[] = [];
  let quality: RuntimeSemanticCompressionQuality = "safe";

  if (reductionRatio >= 0.7 && compressedReasoningTrace.originalItemCount >= 6) {
    quality = "over_compressed";
    findings.push({
      code: "over_compressed_ratio",
      severity: "warning",
      messageKo: "압축 비율이 높아 mobile-safe 표시를 위해 trace가 많이 숨겨졌을 수 있습니다.",
    });
  } else if (reductionRatio < 0.1 && collectRawReasoningTraceItems(reasoningReports).length >= 10) {
    quality = "under_compressed";
    findings.push({
      code: "under_compressed_ratio",
      severity: "info",
      messageKo: "압축 효과가 낮습니다. overlay readability 개선 여지가 제한적입니다.",
    });
  }

  if (semanticRedundancySummary.reasoningExplosionRisk !== "low") {
    quality = quality === "safe" ? "watch" : quality;
    findings.push({
      code: "reasoning_explosion_watch",
      severity: "warning",
      messageKo: "reasoning explosion 위험 — compression quality를 함께 확인하세요.",
    });
  }

  if (hiddenCriticalSignalCount > 0) {
    quality = "watch";
    findings.push({
      code: "hidden_critical_signal",
      severity: "warning",
      messageKo: "숨겨진 trace 중 critical 신호 후보가 있습니다.",
    });
  }

  if (
    stabilizedSemanticOrdering.orderedGroupLabels.length > 0 &&
    semanticGroupsSummary.groups.length > 0 &&
    !stabilizedSemanticOrdering.orderedGroupLabels.every((label) =>
      semanticGroupsSummary.groups.some((g) => g.labelKo === label)
    )
  ) {
    findings.push({
      code: "ordering_group_drift",
      severity: "info",
      messageKo: "stable ordering과 semantic group 라벨이 완전히 일치하지 않을 수 있습니다.",
    });
  }

  findings.push({
    code: "metadata_only",
    severity: "info",
    messageKo: "compression quality는 planning semantic 진단이며 actual orchestration이 아닙니다.",
  });

  const recommendations: string[] = [
    quality === "over_compressed"
      ? "과압축 시 진단 API hidden trace audit을 확인하세요."
      : quality === "under_compressed"
        ? "저압축 시 group balance와 redundancy를 함께 검토하세요."
        : "현재 compression quality는 overlay-safe 범위로 관측됩니다.",
  ];

  return {
    mode: "runtime_semantic_compression_quality",
    actualRuntimeOrchestrationEnabled: false,
    quality,
    preservedCriticalSignalCount,
    hiddenCriticalSignalCount,
    visibleTraceCount,
    hiddenTraceCount,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticCompressionQualityReportForDiagnostic(
  report: RuntimeSemanticCompressionQualityReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeOrchestrationEnabled: report.actualRuntimeOrchestrationEnabled,
    quality: report.quality,
    preservedCriticalSignalCount: report.preservedCriticalSignalCount,
    hiddenCriticalSignalCount: report.hiddenCriticalSignalCount,
    visibleTraceCount: report.visibleTraceCount,
    hiddenTraceCount: report.hiddenTraceCount,
    findings: report.findings.map((f) => ({ ...f })),
    recommendations: [...report.recommendations],
  };
}
