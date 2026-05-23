/**
 * Project SingleChat — block platform orchestration actions (e.g. ADD_ACTOR screen)
 * when the intent is AI-driven service actor definition (actor_definition).
 */

import type { ConversationExecutionScope } from "@/lib/conversation/conversationScopeBoundary";
import { isProjectSingleChatScope } from "@/lib/conversation/conversationScopeBoundary";
import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  normalizeProjectSingleChatStageIntent,
  type ProjectSingleChatStageIntent,
} from "@/lib/requirements/singleChatStageRouter";
import {
  normalizeServiceFlowSubIntent,
  type ServiceFlowSubIntent,
} from "@/lib/requirements/serviceFlowSubIntent";
import type { ServiceFlowMessageSendSource } from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";

export const PROJECT_SINGLE_CHAT_BLOCKED_ORCHESTRATION_ACTIONS = ["ADD_ACTOR"] as const;

export type ProjectSingleChatBlockedOrchestrationAction =
  (typeof PROJECT_SINGLE_CHAT_BLOCKED_ORCHESTRATION_ACTIONS)[number];

export const MANUAL_SERVICE_ACTOR_ADD_CTA_ID = "MANUAL_SERVICE_ACTOR_ADD" as const;

export type ProjectSingleChatManualEditSource = "manual_editor";

export function shouldBlockProjectOrchestrationActionForServiceFlowSubIntent(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly stageIntent?: ProjectSingleChatStageIntent | string | null;
  readonly executionScope?: ConversationExecutionScope | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: string | null;
}): {
  readonly blocked: boolean;
  readonly reason: string | null;
  readonly downgradedTo: QuickActionId | null;
} {
  const none = { blocked: false as const, reason: null, downgradedTo: null };

  if (!isProjectSingleChatScope(input.executionScope)) return none;

  if (String(input.directCtaId ?? "").trim() === MANUAL_SERVICE_ACTOR_ADD_CTA_ID) {
    return none;
  }

  const stageIntent = normalizeProjectSingleChatStageIntent(input.stageIntent);
  const subIntent = normalizeServiceFlowSubIntent(input.serviceFlowSubIntent);
  const suggested = input.suggestedActionId ?? input.directQuickActionId ?? null;

  if (
    stageIntent === "service_flow" &&
    subIntent === "actor_definition" &&
    suggested === "ADD_ACTOR"
  ) {
    return {
      blocked: true,
      reason: "actor_definition_is_not_manual_add_actor",
      downgradedTo: "DIRECT_INPUT",
    };
  }

  return none;
}

export function shouldEnterManualActorEditFromSingleChat(input: {
  readonly effectiveActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
  readonly directCtaId?: string | null;
}): boolean {
  if (input.effectiveActionId !== "ADD_ACTOR") return false;
  if (normalizeServiceFlowSubIntent(input.serviceFlowSubIntent) === "actor_definition") {
    return false;
  }
  return (
    input.source === "manual_editor" &&
    String(input.directCtaId ?? "").trim() === MANUAL_SERVICE_ACTOR_ADD_CTA_ID
  );
}

export function formatProjectSingleChatBoundaryGuardTrace(input: {
  readonly suggested?: QuickActionId | null;
  readonly stageIntent?: ProjectSingleChatStageIntent | string | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly blocked: boolean;
  readonly downgradedTo?: QuickActionId | null;
  readonly reason?: string | null;
}): string {
  return [
    "[projectSingleChatBoundaryGuard]",
    `suggested=${input.suggested ?? ""}`,
    `stageIntent=${input.stageIntent ?? ""}`,
    `serviceFlowSubIntent=${input.serviceFlowSubIntent ?? ""}`,
    `blocked=${String(input.blocked)}`,
    `downgradedTo=${input.downgradedTo ?? ""}`,
    `reason=${input.reason ?? ""}`,
  ].join("\n");
}

export function applyProjectSingleChatBoundaryGuard(input: {
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: QuickActionId | null;
  readonly executionScope: ConversationExecutionScope;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: string | null;
}): {
  readonly effectiveActionId: QuickActionId | null;
  readonly guard: GuardResult;
  readonly boundaryGuardTrace: string;
  readonly intent: IntentRoutingResult;
} {
  const stageIntent = normalizeProjectSingleChatStageIntent(input.intent.stageIntent);
  const subIntent = normalizeServiceFlowSubIntent(input.intent.serviceFlowSubIntent);
  const check = shouldBlockProjectOrchestrationActionForServiceFlowSubIntent({
    suggestedActionId: input.intent.suggestedActionId ?? input.effectiveActionId,
    serviceFlowSubIntent: subIntent,
    stageIntent,
    executionScope: input.executionScope,
    directQuickActionId: input.directQuickActionId,
    directCtaId: input.directCtaId,
  });

  if (!check.blocked || !check.downgradedTo) {
    return {
      effectiveActionId: input.effectiveActionId,
      guard: input.guard,
      boundaryGuardTrace: "",
      intent: input.intent,
    };
  }

  const downgradedTo = check.downgradedTo;
  const trace = formatProjectSingleChatBoundaryGuardTrace({
    suggested: input.intent.suggestedActionId ?? input.effectiveActionId,
    stageIntent,
    serviceFlowSubIntent: subIntent,
    blocked: true,
    downgradedTo,
    reason: check.reason,
  });

  return {
    effectiveActionId: downgradedTo,
    guard: {
      ...input.guard,
      allowed: true,
      effectiveActionId: downgradedTo,
      warning: check.reason ?? input.guard.warning,
    },
    boundaryGuardTrace: trace,
    intent: {
      ...input.intent,
      stageIntent: "service_flow",
      serviceFlowSubIntent: subIntent,
    },
  };
}
