/**
 * Project SingleChat intent dispatch 전용 — Pre-Project messenger에는 적용하지 않는다.
 */

import {
  shouldApplyStrongActionGuard,
  type ConversationExecutionScope,
} from "@/lib/conversation/conversationScopeBoundary";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import { guardRequirementsAction, type GuardResult } from "@/lib/requirements/requirementsActionGuard";
import {
  normalizeActionInvocationStrength,
  normalizeExecutionIntent,
  type ActionInvocationStrength,
  type ExecutionIntent,
  type IntentRoutingResult,
} from "@/lib/requirements/requirementsIntentRouterTypes";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export const STRONG_EXECUTION_ACTION_IDS = [
  "GENERATE_ALTERNATIVE",
  "APPLY_PROPOSAL",
  "APPROVE_FLOW",
  "NEXT_STAGE",
] as const satisfies readonly QuickActionId[];

export type StrongExecutionActionId = (typeof STRONG_EXECUTION_ACTION_IDS)[number];

export type StrongActionPolicyDecision =
  | Readonly<{
      readonly allowed: true;
      readonly reason: string;
    }>
  | Readonly<{
      readonly allowed: false;
      readonly reason: string;
      readonly fallbackActionId?: QuickActionId | null;
      readonly clarificationQuestion?: string;
    }>;

export function isStrongExecutionAction(actionId: QuickActionId | null | undefined): boolean {
  if (!actionId) return false;
  return (STRONG_EXECUTION_ACTION_IDS as readonly string[]).includes(actionId);
}

function pickStrongActionFallback(input: {
  readonly availableActionIds: readonly QuickActionId[];
}): QuickActionId | null {
  if (input.availableActionIds.includes("DIRECT_INPUT")) return "DIRECT_INPUT";
  return null;
}

function allowsExplicitStrongExecution(input: {
  readonly suggestedActionId: QuickActionId;
  readonly executionIntent: ExecutionIntent;
  readonly actionInvocationStrength: ActionInvocationStrength;
}): boolean {
  if (input.actionInvocationStrength !== "explicit") return false;
  if (input.executionIntent === "explicit_execute") return true;
  if (input.executionIntent === "ask_compare" && input.suggestedActionId === "GENERATE_ALTERNATIVE") {
    return true;
  }
  return false;
}

export function evaluateStrongActionExecutionPolicy(input: {
  readonly suggestedActionId: QuickActionId | null;
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly routerMode?: string | null;
  readonly routerConfidence?: number | null;
  readonly executionIntent?: ExecutionIntent | string | null;
  readonly actionInvocationStrength?: ActionInvocationStrength | string | null;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly chatVisibleActionIds?: readonly QuickActionId[];
  readonly conversationState?: string | null;
  readonly intentReason?: string | null;
}): StrongActionPolicyDecision {
  void input.userMessage;
  void input.directQuickActionLabel;
  void input.routerMode;
  void input.routerConfidence;
  void input.authoritativeStage;
  void input.chatVisibleActionIds;
  void input.conversationState;
  void input.intentReason;

  const suggested = input.suggestedActionId;
  if (!suggested || !isStrongExecutionAction(suggested)) {
    return { allowed: true, reason: "not a strong execution action" };
  }

  if (input.directQuickActionId && input.directQuickActionId === suggested) {
    return { allowed: true, reason: "direct quick action" };
  }

  const executionIntent = normalizeExecutionIntent(input.executionIntent);
  const strength = normalizeActionInvocationStrength(input.actionInvocationStrength);

  if (allowsExplicitStrongExecution({ suggestedActionId: suggested, executionIntent, actionInvocationStrength: strength })) {
    return { allowed: true, reason: "explicit execution intent" };
  }

  const fallbackActionId = pickStrongActionFallback({ availableActionIds: input.availableActionIds });
  return {
    allowed: false,
    reason: "이 요청은 강한 플랫폼 실행(대안 생성·적용 등)보다 기획 제안 답변에 가깝습니다.",
    fallbackActionId,
  };
}

export function mergeGuardWithStrongActionPolicy(input: {
  readonly guard: GuardResult;
  readonly suggestedActionId: QuickActionId | null;
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly intent: IntentRoutingResult;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly chatVisibleActionIds?: readonly QuickActionId[];
  readonly conversationState?: string | null;
  readonly executionScope?: ConversationExecutionScope;
}): GuardResult {
  if (input.executionScope && !shouldApplyStrongActionGuard(input.executionScope)) {
    return input.guard;
  }

  const suggested = input.suggestedActionId;
  if (!suggested) return input.guard;

  const strongPolicy = evaluateStrongActionExecutionPolicy({
    suggestedActionId: suggested,
    userMessage: input.userMessage,
    directQuickActionId: input.directQuickActionId,
    directQuickActionLabel: input.directQuickActionLabel,
    routerMode: input.intent.routerMode,
    routerConfidence: input.intent.confidence,
    executionIntent: input.intent.executionIntent,
    actionInvocationStrength: input.intent.actionInvocationStrength,
    authoritativeStage: input.authoritativeStage,
    availableActionIds: input.availableActionIds,
    chatVisibleActionIds: input.chatVisibleActionIds,
    conversationState: input.conversationState,
    intentReason: input.intent.reason,
  });

  if (strongPolicy.allowed) return input.guard;

  const downgrade = strongPolicy.fallbackActionId;
  if (downgrade && input.availableActionIds.includes(downgrade)) {
    const downgraded = guardRequirementsAction({
      suggestedActionId: downgrade,
      authoritativeStage: input.authoritativeStage,
      availableActionIds: input.availableActionIds,
      featureMetrics: input.featureMetrics,
    });
    if (downgraded.allowed) {
      return {
        ...downgraded,
        warning: strongPolicy.reason,
      };
    }
  }

  return {
    allowed: false,
    reason: strongPolicy.reason,
    fallbackActionIds:
      downgrade && input.availableActionIds.includes(downgrade)
        ? [downgrade]
        : input.guard.fallbackActionIds,
    ...(input.guard.warning ? { warning: input.guard.warning } : {}),
  };
}

/** API가 openAlternativeCanvas를 반환해도 direct GENERATE_ALTERNATIVE가 아니면 Viewer를 열지 않는다. */
export function shouldOpenAlternativeCanvasFromAnalyze(input: {
  readonly openAlternativeCanvas?: boolean;
  readonly quickActionId?: QuickActionId | null;
}): boolean {
  if (!input.openAlternativeCanvas) return false;
  return input.quickActionId === "GENERATE_ALTERNATIVE";
}
