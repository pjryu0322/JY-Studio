/**
 * Project SingleChat — block platform orchestration actions (ADD_ACTOR) in general chat.
 * Manual service-actor edit is allowed only from explicit manual_editor + CTA.
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

export function isManualServiceActorAddRequest(input: {
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
  readonly directCtaId?: string | null;
}): boolean {
  return (
    input.source === "manual_editor" &&
    String(input.directCtaId ?? "").trim() === MANUAL_SERVICE_ACTOR_ADD_CTA_ID
  );
}

export function shouldBlockProjectSingleChatOrchestrationAction(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly effectiveActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly stageIntent?: ProjectSingleChatStageIntent | string | null;
  readonly executionScope?: ConversationExecutionScope | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: string | null;
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
}): {
  readonly blocked: boolean;
  readonly reason: string | null;
  readonly downgradedTo: QuickActionId | null;
} {
  const none = { blocked: false as const, reason: null, downgradedTo: null };

  if (!isProjectSingleChatScope(input.executionScope)) return none;

  const action =
    input.suggestedActionId ??
    input.effectiveActionId ??
    input.directQuickActionId ??
    null;

  if (action !== "ADD_ACTOR") return none;

  if (
    isManualServiceActorAddRequest({
      source: input.source,
      directCtaId: input.directCtaId,
    })
  ) {
    return none;
  }

  const subIntent = normalizeServiceFlowSubIntent(input.serviceFlowSubIntent);

  return {
    blocked: true,
    reason:
      subIntent === "actor_definition"
        ? "actor_definition_is_not_manual_add_actor"
        : "project_single_chat_blocks_add_actor",
    downgradedTo: "DIRECT_INPUT",
  };
}

/** @deprecated Prefer shouldBlockProjectSingleChatOrchestrationAction — kept for call-site compatibility */
export function shouldBlockProjectOrchestrationActionForServiceFlowSubIntent(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly stageIntent?: ProjectSingleChatStageIntent | string | null;
  readonly executionScope?: ConversationExecutionScope | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: string | null;
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
}): {
  readonly blocked: boolean;
  readonly reason: string | null;
  readonly downgradedTo: QuickActionId | null;
} {
  return shouldBlockProjectSingleChatOrchestrationAction({
    suggestedActionId: input.suggestedActionId,
    effectiveActionId: input.suggestedActionId,
    serviceFlowSubIntent: input.serviceFlowSubIntent,
    stageIntent: input.stageIntent,
    executionScope: input.executionScope,
    directQuickActionId: input.directQuickActionId,
    directCtaId: input.directCtaId,
    source: input.source,
  });
}

export function shouldEnterManualActorEditFromSingleChat(input: {
  readonly effectiveActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
  readonly directCtaId?: string | null;
}): boolean {
  if (input.effectiveActionId !== "ADD_ACTOR") return false;
  return isManualServiceActorAddRequest(input);
}

export function formatProjectSingleChatBoundaryGuardTrace(input: {
  readonly suggested?: QuickActionId | null;
  readonly effective?: QuickActionId | null;
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
  readonly directCtaId?: string | null;
  readonly stageIntent?: ProjectSingleChatStageIntent | string | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly blocked: boolean;
  readonly downgradedTo?: QuickActionId | null;
  readonly reason?: string | null;
}): string {
  return [
    "[projectSingleChatBoundaryGuard]",
    `suggested=${input.suggested ?? ""}`,
    `effective=${input.effective ?? ""}`,
    `source=${input.source ?? ""}`,
    `directCtaId=${input.directCtaId ?? ""}`,
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
  readonly source?: ServiceFlowMessageSendSource | ProjectSingleChatManualEditSource | null;
}): {
  readonly effectiveActionId: QuickActionId | null;
  readonly guard: GuardResult;
  readonly boundaryGuardTrace: string;
  readonly intent: IntentRoutingResult;
} {
  const stageIntent = normalizeProjectSingleChatStageIntent(input.intent.stageIntent);
  const subIntent = normalizeServiceFlowSubIntent(input.intent.serviceFlowSubIntent);
  const suggested = input.intent.suggestedActionId ?? input.effectiveActionId;

  if (
    isManualServiceActorAddRequest({
      source: input.source,
      directCtaId: input.directCtaId,
    })
  ) {
    return {
      effectiveActionId: input.effectiveActionId,
      guard: input.guard,
      boundaryGuardTrace: formatProjectSingleChatBoundaryGuardTrace({
        suggested,
        effective: input.effectiveActionId,
        source: input.source,
        directCtaId: input.directCtaId,
        stageIntent,
        serviceFlowSubIntent: subIntent,
        blocked: false,
        reason: "manual_service_actor_add_allowed",
      }),
      intent: input.intent,
    };
  }

  const check = shouldBlockProjectSingleChatOrchestrationAction({
    suggestedActionId: suggested,
    effectiveActionId: input.effectiveActionId,
    serviceFlowSubIntent: subIntent,
    stageIntent,
    executionScope: input.executionScope,
    directQuickActionId: input.directQuickActionId,
    directCtaId: input.directCtaId,
    source: input.source,
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
    suggested,
    effective: input.effectiveActionId,
    source: input.source,
    directCtaId: input.directCtaId,
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
