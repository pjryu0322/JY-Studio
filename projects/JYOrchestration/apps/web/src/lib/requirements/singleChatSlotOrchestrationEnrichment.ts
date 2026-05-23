/**
 * Apply slot projection + next-action quick replies to service-flow analyze responses.
 */

import { getServiceFlowSubIntentFromPolicy } from "@/lib/requirements/serviceFlowSubIntent";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import type { RequirementsServiceFlowV1, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  appendSlotOrchestrationAssistantLead,
  buildSlotAwareQuickReplyWires,
  decideSingleChatSlotNextAction,
} from "@/lib/requirements/singleChatSlotNextAction";
import type { QuickReplyWire } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  projectServiceFlowResultToSingleChatSlots,
  type ServiceFlowSlotProjectionSource,
} from "@/lib/requirements/singleChatSlotResultProjection";
import { syncServiceFlowToOrchestrationSlots } from "@/lib/requirements/serviceFlowOrchestrationSync";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export function resolveServiceFlowSlotProjectionSource(input: {
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
  readonly responsePolicy?: unknown;
}): ServiceFlowSlotProjectionSource | null {
  const decision = String(input.proposalDecision ?? "").trim().toUpperCase();
  if (decision === "FLOW_APPROVE") return "flow_approve";
  if (decision === "REVIEW_FLOW") return "flow_review";
  if (decision === "APPLY") return "flow_step_definition";

  const sub = getServiceFlowSubIntentFromPolicy(input.responsePolicy);
  if (sub === "actor_definition") return "actor_definition";
  if (sub === "flow_draft") return "flow_draft";
  if (sub === "flow_step_definition") return "flow_step_definition";
  if (sub === "flow_review") return "flow_review";
  return "flow_draft";
}

export function enrichProjectSingleChatSlotOrchestration(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow: RequirementsServiceFlowV1;
  readonly projectionSource: ServiceFlowSlotProjectionSource;
  readonly conversationQuickReplies: readonly QuickReplyWire[] | readonly string[];
  readonly assistantMessage: string;
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
  readonly skipAssistantLead?: boolean;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly quickReplies: readonly QuickReplyWire[];
  readonly assistantMessage: string;
  readonly requirementsStatePatch: Partial<RequirementsStateJson> | null;
  readonly slotDecision: ReturnType<typeof decideSingleChatSlotNextAction>;
}> {
  const now = input.nowIso ?? new Date().toISOString();
  let orch = input.orchestration;

  const projected = projectServiceFlowResultToSingleChatSlots({
    orchestration: orch,
    definitions: input.definitions,
    flow: input.flow,
    source: input.projectionSource,
    nowIso: now,
  });
  if (projected) orch = projected;

  const sync = syncServiceFlowToOrchestrationSlots({
    flow: input.flow,
    definitions: input.definitions,
    orchestration: orch,
    nowIso: now,
  });
  if (sync?.state) orch = sync.state;

  const slotDecision = decideSingleChatSlotNextAction({
    orchestration: orch,
    definitions: input.definitions,
    flow: input.flow,
  });

  const quickReplies = buildSlotAwareQuickReplyWires({
    conversationQuickReplies: input.conversationQuickReplies,
    decision: slotDecision,
  });

  const assistantMessage = appendSlotOrchestrationAssistantLead({
    assistantMessage: input.assistantMessage,
    decision: slotDecision,
    orchestration: orch,
    definitions: input.definitions,
    skipWhenTransition: input.skipAssistantLead,
  });

  const requirementsStatePatch: Partial<RequirementsStateJson> | null = orch
    ? { singleChatOrchestrationV1: orch }
    : null;

  return {
    orchestration: orch,
    quickReplies,
    assistantMessage,
    requirementsStatePatch,
    slotDecision,
  };
}
