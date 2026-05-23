/**
 * Stage-level governance — bias recommendations and surface blocked/preferred actions.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type StageGovernanceRule = Readonly<{
  readonly blockedActions: readonly QuickActionId[];
  readonly preferredActions: readonly QuickActionId[];
  readonly recommendationBias: Readonly<Partial<Record<QuickActionId, number>>>;
}>;

const STAGE_GOVERNANCE: Partial<Record<OrchestrationStage, StageGovernanceRule>> = {
  FEATURE_DETAIL: {
    blockedActions: ["GENERATE_DOCUMENT", "EXPORT_MARKDOWN", "EXPORT_PDF"],
    preferredActions: ["EDIT_FEATURES", "DEFINE_API"],
    recommendationBias: {
      DEFINE_SCREEN: 5,
      DEFINE_API: 12,
      OPEN_ARTIFACT_HUB: -20,
      EDIT_FEATURES: 8,
    },
  },
  SCREEN_DEFINE: {
    blockedActions: ["GENERATE_DOCUMENT"],
    preferredActions: ["DEFINE_SCREEN", "DEFINE_API"],
    recommendationBias: { DEFINE_SCREEN: 15, DEFINE_API: 8 },
  },
};

export function stageGovernanceFor(stage: OrchestrationStage): StageGovernanceRule {
  return (
    STAGE_GOVERNANCE[stage] ?? {
      blockedActions: [],
      preferredActions: [],
      recommendationBias: {},
    }
  );
}

export function applyStageGovernanceToScore(input: {
  readonly stage: OrchestrationStage;
  readonly actionId: QuickActionId;
  readonly score: number;
}): number {
  const rule = stageGovernanceFor(input.stage);
  if (rule.blockedActions.includes(input.actionId)) return -999;
  const bias = rule.recommendationBias[input.actionId] ?? 0;
  const pref = rule.preferredActions.includes(input.actionId) ? 4 : 0;
  return input.score + bias + pref;
}

export function filterRecommendationsByStageGovernance<T extends { readonly actionId: QuickActionId }>(
  stage: OrchestrationStage,
  recs: readonly T[],
): readonly T[] {
  const blocked = new Set(stageGovernanceFor(stage).blockedActions);
  return recs.filter((r) => !blocked.has(r.actionId));
}
