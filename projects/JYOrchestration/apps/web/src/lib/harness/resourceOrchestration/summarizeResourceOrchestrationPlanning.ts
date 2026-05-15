/**
 * H9 — `GET /api/diagnostics/overlay-runtime`용 **직렬화 가능** 요약.
 */

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { composeResourceOrchestrationPlanning, hasResourceOrchestrationPlanningOverlaySignals } from "./composeResourceOrchestrationPlanning";

export function summarizeResourceOrchestrationPlanning(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): Readonly<{
  hasData: boolean;
  roleKey: string | null;
  resolvedContractRoleKey: string | null;
  providerPlanLabel: string;
  retrievalStance: string;
  memoryStance: string;
  knowledgeStance: string;
  orchestrationConcurrencyHint: string;
  pressureLevel: string;
  pressureScore: number;
  pressureFactors: readonly string[];
  currentBudgetPolicy: string | null;
  recommendedBudgetPolicy: string;
  budgetPolicyAligned: boolean;
  budgetRecommendationRationale: string;
  planningDisclaimer: string;
}> {
  const core = composeResourceOrchestrationPlanning(extract);
  const hasData = hasResourceOrchestrationPlanningOverlaySignals(extract);

  return {
    hasData,
    roleKey: core.roleKey,
    resolvedContractRoleKey: core.plan.resolvedContractRoleKey,
    providerPlanLabel: core.plan.providerPlanLabel,
    retrievalStance: core.plan.retrievalStance,
    memoryStance: core.plan.memoryStance,
    knowledgeStance: core.plan.knowledgeStance,
    orchestrationConcurrencyHint: core.plan.orchestrationConcurrencyHint,
    pressureLevel: core.pressure.level,
    pressureScore: core.pressure.score,
    pressureFactors: core.pressure.factors,
    currentBudgetPolicy: core.recommendation.currentPolicy,
    recommendedBudgetPolicy: core.recommendation.recommendedPolicy,
    budgetPolicyAligned: core.recommendation.aligned,
    budgetRecommendationRationale: core.recommendation.rationale,
    planningDisclaimer: core.plan.planningDisclaimer,
  };
}
