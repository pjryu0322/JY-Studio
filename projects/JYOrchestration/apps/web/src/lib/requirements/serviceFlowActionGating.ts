/**
 * Project SingleChat — reviewable flow 기준 apply/alternative quick action gating.
 */

import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import { serviceFlowHasMinimumDraftForApply } from "@/lib/requirements/serviceFlowAdviceApplyMode";
import type { QuickAction, QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowSubIntent } from "@/lib/requirements/serviceFlowSubIntent";

export type ServiceFlowActionGateResult = Readonly<{
  readonly allowed: boolean;
  readonly reason: string | null;
}>;

const APPLY_OR_ALTERNATIVE_ACTION_IDS = new Set<QuickActionId>([
  "APPLY_PROPOSAL",
  "APPLY_ALTERNATIVE",
  "GENERATE_ALTERNATIVE",
  "APPROVE_FLOW",
]);

const APPLY_OR_ALTERNATIVE_LABEL_RE =
  /^(이\s*대안\s*적용|다른\s*대안|추천안\s*적용|대안\s*다시\s*생성|일부\s*수정|다른\s*대안\s*보기)$/i;

function hydratedFlow(flow: RequirementsServiceFlowV1 | null | undefined): RequirementsServiceFlowV1 {
  return hydrateServiceFlowStepsFromAlternativePayload(
    flow ?? { createdAt: "", updatedAt: "", actors: [], steps: [] },
  );
}

function stepActorMappingsValid(flow: RequirementsServiceFlowV1): boolean {
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  if (!steps.length) return false;
  const actorIds = new Set(actors.map((a) => String(a.id ?? "").trim()).filter(Boolean));
  for (const step of steps) {
    const pid = String(step.primaryActorId ?? "").trim();
    if (pid && !actorIds.has(pid)) return false;
  }
  return true;
}

export function canApplyServiceFlowProposal(
  flow: RequirementsServiceFlowV1 | null | undefined,
): ServiceFlowActionGateResult {
  const hydrated = hydratedFlow(flow);
  if (!serviceFlowHasMinimumDraftForApply(hydrated)) {
    const actors = hydrated.actors?.length ?? 0;
    const steps = hydrated.steps?.length ?? 0;
    if (actors < 2) {
      return { allowed: false, reason: "apply_requires_actors" };
    }
    if (steps < 3) {
      return { allowed: false, reason: "apply_requires_steps" };
    }
    return { allowed: false, reason: "apply_requires_reviewable_flow" };
  }
  if (!stepActorMappingsValid(hydrated)) {
    return { allowed: false, reason: "apply_requires_valid_step_actor_mapping" };
  }
  return { allowed: true, reason: null };
}

export function canGenerateAlternativeForServiceFlow(
  flow: RequirementsServiceFlowV1 | null | undefined,
): ServiceFlowActionGateResult {
  return canApplyServiceFlowProposal(flow);
}

export function shouldShowServiceFlowApplyActions(
  flow: RequirementsServiceFlowV1 | null | undefined,
): boolean {
  return canApplyServiceFlowProposal(flow).allowed;
}

export function isApplyOrAlternativeQuickActionId(id: QuickActionId | string | null | undefined): boolean {
  const v = String(id ?? "").trim() as QuickActionId;
  return APPLY_OR_ALTERNATIVE_ACTION_IDS.has(v);
}

export function isApplyOrAlternativeQuickReplyLabel(label: string | null | undefined): boolean {
  const t = String(label ?? "").trim();
  if (!t) return false;
  if (APPLY_OR_ALTERNATIVE_LABEL_RE.test(t)) return true;
  return /대안/.test(t) && /(적용|생성|보기)/.test(t);
}

export function filterQuickActionsForServiceFlowGating(
  actions: readonly QuickAction[],
  flow: RequirementsServiceFlowV1 | null | undefined,
): readonly QuickAction[] {
  if (shouldShowServiceFlowApplyActions(flow)) return actions;
  return actions.filter((a) => !isApplyOrAlternativeQuickActionId(a.id));
}

export function filterQuickReplyLabelsForServiceFlowGating(
  labels: readonly string[],
  flow: RequirementsServiceFlowV1 | null | undefined,
): readonly string[] {
  if (shouldShowServiceFlowApplyActions(flow)) return labels;
  return labels.filter((l) => !isApplyOrAlternativeQuickReplyLabel(l));
}

export function buildServiceFlowGatedQuickReplyLabels(
  flow: RequirementsServiceFlowV1 | null | undefined,
): readonly string[] {
  const hydrated = hydratedFlow(flow);
  const actorCount = hydrated.actors?.length ?? 0;
  const stepCount = hydrated.steps?.length ?? 0;

  if (actorCount >= 2 && stepCount < 3) {
    return ["단계 정리하기", "서비스 흐름 단계 만들기", "화면 구성부터 보기"];
  }
  if (actorCount < 2) {
    return ["액터부터 정의하기", "서비스 흐름 초안 만들기"];
  }
  return ["흐름 검토하기", "화면 구성부터 보기"];
}

export type BlockedApplyRedirectResult = Readonly<{
  readonly effectiveActionId: "DIRECT_INPUT";
  readonly serviceFlowSubIntent: ServiceFlowSubIntent;
  readonly reason: string;
}>;

export function resolveBlockedApplyRedirect(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
}): BlockedApplyRedirectResult | null {
  const suggested = String(input.suggestedActionId ?? "").trim() as QuickActionId;
  if (suggested !== "APPLY_PROPOSAL" && suggested !== "APPLY_ALTERNATIVE") return null;
  if (canApplyServiceFlowProposal(input.currentFlow).allowed) return null;

  const actors = input.currentFlow?.actors?.length ?? 0;
  if (actors >= 2) {
    return {
      effectiveActionId: "DIRECT_INPUT",
      serviceFlowSubIntent: "flow_step_definition",
      reason: "apply_requires_steps_redirect_to_flow_step_definition",
    };
  }
  return {
    effectiveActionId: "DIRECT_INPUT",
    serviceFlowSubIntent: "actor_definition",
    reason: "apply_requires_actors_redirect_to_actor_definition",
  };
}

/** stage transition(FLOW_APPROVE 등) precondition 실패 시 analyze로 유도 */
export function resolveBlockedStageTransitionRedirect(input: {
  readonly proposalDecision: string | null | undefined;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
}): BlockedApplyRedirectResult | null {
  const decision = String(input.proposalDecision ?? "").trim();
  const transitionDecisions = new Set([
    "FLOW_APPROVE",
    "FEATURE_DETAIL",
    "NEXT_STAGE",
    "DOCUMENTATION_COMPLETE",
  ]);
  if (!transitionDecisions.has(decision)) return null;
  if (canApplyServiceFlowProposal(input.currentFlow).allowed) return null;

  const actors = input.currentFlow?.actors?.length ?? 0;
  if (actors >= 2) {
    return {
      effectiveActionId: "DIRECT_INPUT",
      serviceFlowSubIntent: "flow_step_definition",
      reason: "stage_transition_requires_steps_redirect_to_flow_step_definition",
    };
  }
  return {
    effectiveActionId: "DIRECT_INPUT",
    serviceFlowSubIntent: "actor_definition",
    reason: "stage_transition_requires_actors_redirect_to_actor_definition",
  };
}
