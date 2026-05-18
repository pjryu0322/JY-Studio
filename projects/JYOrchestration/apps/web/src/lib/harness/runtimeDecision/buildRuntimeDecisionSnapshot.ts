/**
 * H19.5 — 특정 시점 **orchestration decision snapshot**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeDecision } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeDecisionCoherence } from "./runtimeDecisionTypes";
import type { RuntimeDecisionLineage } from "./runtimeDecisionTypes";
import type { RuntimeRecommendationSummary } from "./runtimeDecisionTypes";
import type { RuntimeDecisionSnapshot } from "./runtimeDecisionTypes";

export function buildRuntimeDecisionSnapshot(
  semanticReports: RuntimeSemanticPlanningReportsBeforeDecision,
  lineage: RuntimeDecisionLineage,
  recommendation: RuntimeRecommendationSummary,
  coherence: RuntimeDecisionCoherence
): RuntimeDecisionSnapshot {
  const criticalPath = semanticReports.semanticGraphRelevanceSummary.criticalPath;
  const topPriority = semanticReports.semanticPriorityVocabulary.topPriorityLabelKo;

  const summaryKo = [
    `우선순위: ${topPriority}`,
    `권장: ${recommendation.primaryRecommendationKo}`,
    `coherence: ${coherence.overallLevel}`,
    lineage.primaryReason?.messageKo ?? "primary decision reason 없음",
  ].join(" · ");

  return {
    mode: "runtime_decision_snapshot",
    actualRuntimeOrchestrationEnabled: false,
    snapshotId: "runtime-planning-decision-snapshot",
    capturedAtLabel: "planning evaluation (read-only)",
    topPriorityLabel: topPriority,
    criticalPathLabel: criticalPath,
    coherenceLevel: coherence.overallLevel,
    summaryKo: summaryKo.slice(0, 280),
  };
}

export function serializeRuntimeDecisionSnapshotForDiagnostic(
  snapshot: RuntimeDecisionSnapshot
): Readonly<Record<string, unknown>> {
  return {
    mode: snapshot.mode,
    actualRuntimeOrchestrationEnabled: snapshot.actualRuntimeOrchestrationEnabled,
    snapshotId: snapshot.snapshotId,
    capturedAtLabel: snapshot.capturedAtLabel,
    topPriorityLabel: snapshot.topPriorityLabel,
    criticalPathLabel: snapshot.criticalPathLabel,
    coherenceLevel: snapshot.coherenceLevel,
    summaryKo: snapshot.summaryKo,
  };
}
