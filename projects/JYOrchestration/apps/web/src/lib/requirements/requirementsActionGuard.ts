/**
 * Registry Guard — validates router/LLM suggested actions before execution.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { isArtifactChatSuppressedActionId } from "@/lib/requirements/requirementsIntentRouterTypes";
import {
  getQuickActionCategory,
  guardQuickActionByPolicy,
  isBlockedScreenApiWithoutConfirmedFeatures,
  type QuickActionCategory,
} from "@/lib/requirements/requirementsQuickActionPolicy";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type GuardResult = Readonly<{
  readonly allowed: boolean;
  readonly reason?: string;
  readonly fallbackActionIds?: readonly QuickActionId[];
  readonly warning?: string;
  /** Guard-normalized action (e.g. artifact doc → Artifact Hub). */
  readonly effectiveActionId?: QuickActionId;
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
  if (
    (category === "orchestration_action" || category === "edit_request") &&
    (stage === "FEATURE_DETAIL" || stage === "SCREEN_DEFINE")
  ) {
    return ["EDIT_FEATURES"];
  }
  if (category === "view_action") {
    return ["OPEN_CANVAS", "OPEN_ARTIFACT_HUB"];
  }
  return ["EDIT_FEATURES"];
}

function normalizeSuggestedAction(input: RequirementsActionGuardInput): {
  readonly actionId: QuickActionId;
  readonly warning?: string;
} {
  const { suggestedActionId, availableActionIds } = input;
  if (isArtifactChatSuppressedActionId(suggestedActionId)) {
    if (availableActionIds.includes("OPEN_ARTIFACT_HUB")) {
      return {
        actionId: "OPEN_ARTIFACT_HUB",
        warning: "문서·산출물 생성은 Artifact Hub에서 진행합니다.",
      };
    }
  }
  return { actionId: suggestedActionId };
}

export function guardRequirementsAction(input: RequirementsActionGuardInput): GuardResult {
  const normalized = normalizeSuggestedAction(input);
  const actionId = normalized.actionId;

  if (!input.availableActionIds.includes(actionId)) {
    const category = getQuickActionCategory(actionId);
    return {
      allowed: false,
      reason: "현재 단계에서 사용할 수 없는 동작입니다.",
      fallbackActionIds: defaultFallbacksForCategory(category, input.authoritativeStage).filter((id) =>
        input.availableActionIds.includes(id),
      ),
    };
  }

  if (isBlockedScreenApiWithoutConfirmedFeatures(actionId, input.featureMetrics)) {
    const editFeatures: QuickActionId = "EDIT_FEATURES";
    const fallbacks: QuickActionId[] = input.availableActionIds.includes(editFeatures) ? [editFeatures] : [];
    return {
      allowed: false,
      reason: "확정된 기능이 없습니다. 「기능 수정」으로 먼저 기능을 확정해 주세요.",
      fallbackActionIds: fallbacks,
    };
  }

  const policy = guardQuickActionByPolicy({
    actionId,
    authoritativeStage: input.authoritativeStage,
    featureMetrics: input.featureMetrics,
  });

  if (!policy.allowed) {
    const category = getQuickActionCategory(actionId);
    const fallbacks = defaultFallbacksForCategory(category, input.authoritativeStage).filter(
      (id) => input.availableActionIds.includes(id) && id !== actionId,
    );
    return {
      allowed: false,
      reason: policy.reason,
      fallbackActionIds:
        fallbacks.length ? fallbacks
        : input.availableActionIds.includes("EDIT_FEATURES") ? (["EDIT_FEATURES"] as const)
        : [],
      warning: category === "artifact_action" ? normalized.warning : undefined,
    };
  }

  const viewWarning =
    (actionId === "OPEN_CANVAS" || actionId === "OPEN_ARTIFACT_HUB") && normalized.warning ?
      normalized.warning
    : actionId === "OPEN_ARTIFACT_HUB" && normalized.warning ?
      normalized.warning
    : undefined;

  return {
    allowed: true,
    effectiveActionId: actionId,
    ...(viewWarning ? { warning: viewWarning } : {}),
  };
}
