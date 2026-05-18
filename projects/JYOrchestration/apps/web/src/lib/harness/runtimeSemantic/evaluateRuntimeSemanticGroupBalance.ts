/**
 * H17.5 — semantic group **balance** 평가(read-only).
 */

import type { RuntimeSemanticGroupKind, RuntimeSemanticGroupsSummary } from "./runtimeSemanticTypes";
import type {
  RuntimeSemanticAuditFinding,
  RuntimeSemanticGroupBalanceLevel,
  RuntimeSemanticGroupBalanceSummary,
} from "./runtimeSemanticQualityTypes";

const CRITICAL_GROUP_KINDS: readonly RuntimeSemanticGroupKind[] = [
  "governance",
  "dependency",
  "criticality",
];

export function evaluateRuntimeSemanticGroupBalance(
  semanticGroupsSummary: RuntimeSemanticGroupsSummary
): RuntimeSemanticGroupBalanceSummary {
  const { groups, totalItemCount } = semanticGroupsSummary;
  const findings: RuntimeSemanticAuditFinding[] = [];

  const itemCounts = groups.map((g) => ({
    kind: g.kind,
    count: g.compressedItems.length,
  }));
  const totalGrouped = itemCounts.reduce((n, x) => n + x.count, 0) || 1;
  const dominant = [...itemCounts].sort((a, b) => b.count - a.count)[0];
  const dominantGroupKind = dominant?.count ? dominant.kind : "none";
  const dominantShare = dominant ? Math.round((dominant.count / totalGrouped) * 100) : 0;

  const otherGroup = groups.find((g) => g.kind === "other");
  const otherGroupSharePercent = otherGroup
    ? Math.round((otherGroup.compressedItems.length / totalGrouped) * 100)
    : 0;

  const presentKinds = new Set(groups.map((g) => g.kind));
  const missingCriticalGroups = CRITICAL_GROUP_KINDS.filter((k) => !presentKinds.has(k));

  let balanceLevel: RuntimeSemanticGroupBalanceLevel = "balanced";

  if (otherGroupSharePercent >= 40) {
    balanceLevel = "imbalanced";
    findings.push({
      code: "other_group_excess",
      severity: "warning",
      messageKo: "other semantic group 비중이 높습니다 — grouping 품질을 점검하세요.",
    });
  }

  if (dominantShare >= 55 && groups.length >= 2) {
    balanceLevel = balanceLevel === "imbalanced" ? "imbalanced" : "watch";
    findings.push({
      code: "dominant_group_skew",
      severity: "warning",
      messageKo: `${dominantGroupKind} group에 reasoning이 쏠려 있습니다.`,
    });
  }

  if (missingCriticalGroups.length >= 2 && totalItemCount >= 4) {
    balanceLevel = balanceLevel === "balanced" ? "watch" : balanceLevel;
    findings.push({
      code: "missing_critical_groups",
      severity: "info",
      messageKo: "governance·dependency·criticality group 일부가 누락되었습니다.",
    });
  }

  const governanceGroup = groups.find((g) => g.kind === "governance");
  if (governanceGroup && governanceGroup.compressedItems.length >= 4) {
    findings.push({
      code: "governance_group_dense",
      severity: "info",
      messageKo: "governance group 항목이 많습니다.",
    });
  }

  const recommendations: string[] = [
    "Group balance는 read-only planning 메타입니다. enforcement 없음.",
    balanceLevel === "balanced"
      ? "semantic group 분포가 관측 범위에서 균형적입니다."
      : "overlay에는 group balance 상위 4건만 표시하세요.",
  ];

  return {
    mode: "runtime_semantic_group_balance_summary",
    actualRuntimeOrchestrationEnabled: false,
    balanceLevel,
    dominantGroupKind,
    missingCriticalGroups,
    otherGroupSharePercent,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticGroupBalanceSummaryForDiagnostic(
  summary: RuntimeSemanticGroupBalanceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    balanceLevel: summary.balanceLevel,
    dominantGroupKind: summary.dominantGroupKind,
    missingCriticalGroups: [...summary.missingCriticalGroups],
    otherGroupSharePercent: summary.otherGroupSharePercent,
    findings: summary.findings.map((f) => ({ ...f })),
    recommendations: [...summary.recommendations],
  };
}
