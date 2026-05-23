/**
 * Project SingleChat — orchestration transition quick actions (API fast path, not LLM analyze).
 */

import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ProjectSingleChatStageRoutingResult } from "@/lib/requirements/singleChatStageRouter";

const TRANSITION_QUICK_ACTION_IDS = new Set<QuickActionId>([
  "APPROVE_FLOW",
  "NEXT_STAGE",
  "START_FEATURE_DETAIL",
]);

export function isProjectSingleChatTransitionQuickAction(id?: QuickActionId | null): boolean {
  if (!id) return false;
  return TRANSITION_QUICK_ACTION_IDS.has(id);
}

/** Transition chips must reach service-flow-analyze fast path even when stage router disables analyze. */
export function shouldCallAnalyzeForTransitionQuickAction(input: {
  readonly quickActionId?: QuickActionId | null;
}): boolean {
  return isProjectSingleChatTransitionQuickAction(input.quickActionId);
}

export function routeProjectSingleChatOrchestrationTransition(
  effectiveActionId?: QuickActionId | null,
): ProjectSingleChatStageRoutingResult | null {
  if (effectiveActionId === "APPROVE_FLOW") {
    return {
      stageIntent: "flow_review",
      serviceFlowSubIntent: "flow_review",
      shouldRunServiceFlowAnalyze: false,
      shouldRunOrchestrationTransition: true,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "flow_approve_transition",
    };
  }
  if (effectiveActionId === "NEXT_STAGE") {
    return {
      stageIntent: "feature_planning",
      shouldRunServiceFlowAnalyze: false,
      shouldRunOrchestrationTransition: true,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "next_stage_transition",
    };
  }
  if (effectiveActionId === "START_FEATURE_DETAIL") {
    return {
      stageIntent: "feature_planning",
      shouldRunServiceFlowAnalyze: false,
      shouldRunOrchestrationTransition: true,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "feature_detail_start_transition",
    };
  }
  return null;
}
