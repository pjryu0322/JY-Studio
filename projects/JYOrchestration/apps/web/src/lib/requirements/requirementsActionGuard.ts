/**
 * Registry Guard — validates LLM/router suggested actions before execution.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  getQuickActionCategory,
  guardQuickActionByPolicy,
  type QuickActionCategory,
} from "@/lib/requirements/requirementsQuickActionPolicy";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type GuardResult = Readonly<{
  readonly allowed: boolean;
  readonly reason?: string;
  readonly fallbackActionIds?: readonly QuickActionId[];
  readonly warning?: string;
}>;

export type RequirementsActionGuardInput = Readonly<{
  readonly suggestedActionId: QuickActionId;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly featureMetrics: FeatureDetailProjectionMetrics;
}>;

function defaultFallbacksForCategory(
  category: QuickActionCategory,
  stage: OrchestrationStage,
): readonly QuickActionId[] {
  if (category === "artifact_action") {
    return ["OPEN_ARTIFACT_HUB", "EDIT_FEATURES"];
  }
  if (category === "orchestration_action" && (stage === "FEATURE_DETAIL" || stage === "SCREEN_DEFINE")) {
    return ["EDIT_FEATURES", "DEFINE_SCREEN", "DEFINE_API"];
  }
  if (category === "view_action") {
    return ["OPEN_CANVAS", "OPEN_ARTIFACT_HUB"];
  }
  return ["EDIT_FEATURES"];
}

export function guardRequirementsAction(input: RequirementsActionGuardInput): GuardResult {
  if (!input.availableActionIds.includes(input.suggestedActionId)) {
    const category = getQuickActionCategory(input.suggestedActionId);
    return {
      allowed: false,
      reason: "현재 단계에서 사용할 수 없는 동작입니다.",
      fallbackActionIds: defaultFallbacksForCategory(category, input.authoritativeStage).filter((id) =>
        input.availableActionIds.includes(id),
      ),
    };
  }

  const policy = guardQuickActionByPolicy({
    actionId: input.suggestedActionId,
    authoritativeStage: input.authoritativeStage,
    featureMetrics: input.featureMetrics,
  });

  if (!policy.allowed) {
    const category = getQuickActionCategory(input.suggestedActionId);
    const fallbacks = defaultFallbacksForCategory(category, input.authoritativeStage).filter(
      (id) => input.availableActionIds.includes(id) && id !== input.suggestedActionId,
    );
    const warning =
      category === "artifact_action" ?
        "문서·산출물 생성은 Artifact Hub에서 진행합니다. 먼저 기능을 확정해 주세요."
      : undefined;
    return {
      allowed: false,
      reason: policy.reason,
      fallbackActionIds: fallbacks.length ? fallbacks : ["EDIT_FEATURES"].filter((id) =>
        input.availableActionIds.includes(id),
      ),
      warning,
    };
  }

  return { allowed: true };
}
