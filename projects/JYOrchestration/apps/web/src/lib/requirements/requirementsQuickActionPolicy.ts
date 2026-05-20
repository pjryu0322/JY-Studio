/**
 * QuickAction policy — stage/metrics gating beyond conversation profile.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  type QuickAction,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";

export type QuickActionCategory = "orchestration_action" | "artifact_action" | "view_action";

export type QuickActionPolicy = Readonly<{
  readonly actionCategory: QuickActionCategory;
  readonly allowedStages?: readonly OrchestrationStage[];
  readonly requiredConfirmedFeatureCount?: number;
  readonly requiredCoverage?: number;
  readonly chatChipVisible?: boolean;
}>;

const DEFAULT_POLICY: QuickActionPolicy = {
  actionCategory: "orchestration_action",
  chatChipVisible: true,
};

const POLICY_BY_ID: Partial<Record<QuickActionId, QuickActionPolicy>> = {
  APPROVE_FLOW: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW"] },
  REVIEW_FLOW: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW"] },
  EDIT_STEPS: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW_REVIEW"] },
  ADD_ACTOR: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW_REVIEW"] },
  START_FEATURE_DETAIL: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW_REVIEW"] },
  NEXT_STAGE: { actionCategory: "orchestration_action" },
  EDIT_FEATURES: { actionCategory: "orchestration_action", allowedStages: ["FEATURE_DETAIL", "SCREEN_DEFINE"] },
  DEFINE_SCREEN: {
    actionCategory: "orchestration_action",
    allowedStages: ["FEATURE_DETAIL", "SCREEN_DEFINE"],
    requiredConfirmedFeatureCount: 1,
  },
  DEFINE_API: {
    actionCategory: "orchestration_action",
    allowedStages: ["FEATURE_DETAIL", "SCREEN_DEFINE"],
    requiredConfirmedFeatureCount: 1,
  },
  GENERATE_DOCUMENT: {
    actionCategory: "artifact_action",
    allowedStages: ["FEATURE_DETAIL", "DOCUMENTATION_COMPLETE"],
    requiredConfirmedFeatureCount: 1,
    chatChipVisible: false,
  },
  OPEN_CANVAS: {
    actionCategory: "view_action",
    allowedStages: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW", "FEATURE_DETAIL", "SCREEN_DEFINE", "IDEATION"],
    chatChipVisible: false,
  },
  OPEN_ARTIFACT_HUB: {
    actionCategory: "view_action",
    allowedStages: ["FEATURE_DETAIL", "DOCUMENTATION_COMPLETE", "SERVICE_FLOW_REVIEW"],
    chatChipVisible: false,
  },
  VIEW_ALTERNATIVE_DETAIL: { actionCategory: "view_action", allowedStages: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW"] },
  GENERATE_ALTERNATIVE: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW"] },
  APPLY_PROPOSAL: { actionCategory: "orchestration_action", allowedStages: ["SERVICE_FLOW"] },
  COMPLETE_DOCUMENTATION: { actionCategory: "orchestration_action", allowedStages: ["DOCUMENTATION_COMPLETE"] },
  DOCUMENT_FLOW: { actionCategory: "orchestration_action", allowedStages: ["DOCUMENTATION_COMPLETE"] },
};

export function getQuickActionPolicy(id: QuickActionId): QuickActionPolicy {
  return POLICY_BY_ID[id] ?? DEFAULT_POLICY;
}

export function getQuickActionCategory(id: QuickActionId): QuickActionCategory {
  return getQuickActionPolicy(id).actionCategory;
}

export function isChatVisibleQuickAction(id: QuickActionId): boolean {
  return getQuickActionPolicy(id).chatChipVisible !== false;
}

export function guardQuickActionByPolicy(input: {
  readonly actionId: QuickActionId;
  readonly authoritativeStage: OrchestrationStage;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
}): { readonly allowed: boolean; readonly reason?: string } {
  const policy = getQuickActionPolicy(input.actionId);
  if (policy.allowedStages?.length && !policy.allowedStages.includes(input.authoritativeStage)) {
    return { allowed: false, reason: "현재 단계에서 사용할 수 없는 동작입니다." };
  }
  const needConfirmed = policy.requiredConfirmedFeatureCount ?? 0;
  if (needConfirmed > 0 && input.featureMetrics.confirmedFeatureCount < needConfirmed) {
    return {
      allowed: false,
      reason: "확정된 기능이 없습니다. 「기능 수정」으로 먼저 기능을 확정해 주세요.",
    };
  }
  const needCoverage = policy.requiredCoverage ?? 0;
  if (needCoverage > 0 && input.featureMetrics.featureCoverage < needCoverage) {
    return {
      allowed: false,
      reason: `기능 확정률이 ${Math.round(needCoverage * 100)}% 이상일 때 진행할 수 있습니다.`,
    };
  }
  return { allowed: true };
}

export function filterQuickActionsForChatProjection(
  actions: readonly QuickAction[],
): readonly QuickAction[] {
  return actions.filter((a) => isChatVisibleQuickAction(a.id));
}

export function listAllowedActionIdsForStage(input: {
  readonly stage: OrchestrationStage;
  readonly candidateActions: readonly QuickAction[];
  readonly featureMetrics: FeatureDetailProjectionMetrics;
}): readonly QuickActionId[] {
  const out: QuickActionId[] = [];
  for (const action of input.candidateActions) {
    const { allowed } = guardQuickActionByPolicy({
      actionId: action.id,
      authoritativeStage: input.stage,
      featureMetrics: input.featureMetrics,
    });
    if (allowed) out.push(action.id);
  }
  return out;
}
