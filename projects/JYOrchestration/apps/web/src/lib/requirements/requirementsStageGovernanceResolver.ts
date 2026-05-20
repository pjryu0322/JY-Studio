/**
 * Stage governance conflict resolver — blocked > clarification > preferred > bias.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { stageGovernanceFor } from "@/lib/requirements/requirementsStageGovernance";

export type GovernanceResolution = Readonly<{
  readonly actionId: QuickActionId;
  readonly allowed: boolean;
  readonly adjustedScore: number;
  readonly resolution: "blocked" | "clarification-required" | "preferred" | "bias" | "neutral";
  readonly reason: string;
}>;

export function resolveStageGovernanceForAction(input: {
  readonly stage: OrchestrationStage;
  readonly actionId: QuickActionId;
  readonly score: number;
  readonly clarificationPending?: boolean;
}): GovernanceResolution {
  const rule = stageGovernanceFor(input.stage);

  if (rule.blockedActions.includes(input.actionId)) {
    return {
      actionId: input.actionId,
      allowed: false,
      adjustedScore: -999,
      resolution: "blocked",
      reason: `stage:${input.stage} blocks ${input.actionId}`,
    };
  }

  if (input.clarificationPending && rule.blockedActions.length === 0) {
    const docActions = new Set<QuickActionId>(["GENERATE_DOCUMENT", "EXPORT_MARKDOWN", "EXPORT_PDF"]);
    if (docActions.has(input.actionId)) {
      return {
        actionId: input.actionId,
        allowed: false,
        adjustedScore: -50,
        resolution: "clarification-required",
        reason: "clarification pending — document actions deferred",
      };
    }
  }

  if (rule.preferredActions.includes(input.actionId)) {
    const bias = rule.recommendationBias[input.actionId] ?? 0;
    return {
      actionId: input.actionId,
      allowed: true,
      adjustedScore: input.score + bias + 4,
      resolution: "preferred",
      reason: `preferred at ${input.stage}`,
    };
  }

  const bias = rule.recommendationBias[input.actionId] ?? 0;
  if (bias !== 0) {
    return {
      actionId: input.actionId,
      allowed: true,
      adjustedScore: input.score + bias,
      resolution: "bias",
      reason: `bias:${bias}`,
    };
  }

  return {
    actionId: input.actionId,
    allowed: true,
    adjustedScore: input.score,
    resolution: "neutral",
    reason: "no governance override",
  };
}

export function applyGovernanceResolverToScore(input: {
  readonly stage: OrchestrationStage;
  readonly actionId: QuickActionId;
  readonly score: number;
  readonly clarificationPending?: boolean;
}): number {
  return resolveStageGovernanceForAction(input).adjustedScore;
}
