/**
 * Project SingleChat — route slot-action chips before service-flow stage no-op.
 */

import { isProjectSingleChatScope, type ConversationExecutionScope } from "@/lib/conversation/conversationScopeBoundary";
import {
  isSingleChatSlotActionWire,
  resolveSlotActionIdFromLabel,
  slotActionWire,
  type SingleChatSlotActionId,
  type SingleChatSlotActionWire,
} from "@/lib/requirements/singleChatSlotActionTypes";
import type {
  SingleChatRecommendedOwnerAgent,
  SingleChatSlotFocusArea,
} from "@/lib/requirements/singleChatSlotNextAction";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type SingleChatSlotActionRoutingResult = Readonly<{
  readonly shouldRunSlotAction: boolean;
  readonly slotActionId: SingleChatSlotActionId | null;
  readonly slotAction: SingleChatSlotActionWire | null;
  readonly focusArea: SingleChatSlotFocusArea | null;
  readonly ownerAgent: SingleChatRecommendedOwnerAgent | null;
  readonly targetSlotKeys: readonly string[];
  readonly reason: string;
}>;

function emptyRoute(reason: string): SingleChatSlotActionRoutingResult {
  return {
    shouldRunSlotAction: false,
    slotActionId: null,
    slotAction: null,
    focusArea: null,
    ownerAgent: null,
    targetSlotKeys: [],
    reason,
  };
}

export function routeSingleChatSlotAction(input: {
  readonly executionScope: ConversationExecutionScope;
  readonly slotAction?: SingleChatSlotActionWire | null;
  readonly directSlotActionId?: SingleChatSlotActionId | null;
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): SingleChatSlotActionRoutingResult {
  if (!isProjectSingleChatScope(input.executionScope)) {
    return emptyRoute("not_project_single_chat");
  }

  if (input.slotAction && isSingleChatSlotActionWire(input.slotAction)) {
    return {
      shouldRunSlotAction: true,
      slotActionId: input.slotAction.id,
      slotAction: input.slotAction,
      focusArea: input.slotAction.focusArea,
      ownerAgent: input.slotAction.ownerAgent,
      targetSlotKeys: [...(input.slotAction.targetSlotKeys ?? [])],
      reason: "slot_action_wire",
    };
  }

  const id =
    input.directSlotActionId ??
    resolveSlotActionIdFromLabel(input.quickActionLabel) ??
    resolveSlotActionIdFromLabel(input.userMessage);
  if (!id) return emptyRoute("no_slot_action_signal");

  const wire = slotActionWire({
    id,
    label: String(input.quickActionLabel ?? input.userMessage ?? "").trim() || undefined,
    focusArea: "planning",
    ownerAgent: "planner",
    definitions: input.definitions,
  });

  return {
    shouldRunSlotAction: true,
    slotActionId: id,
    slotAction: wire,
    focusArea: wire.focusArea,
    ownerAgent: wire.ownerAgent,
    targetSlotKeys: [...(wire.targetSlotKeys ?? [])],
    reason: "direct_slot_action_id",
  };
}
