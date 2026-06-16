/**
 * Runtime orchestration stage registry — authoritative stage graph (not UI string compares).
 */

import type { RequirementsOrchestrationStageWire, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import {
  resolveServiceFlowConversationState,
  type ServiceFlowConversationState,
} from "@/lib/requirements/serviceFlowConversationState";
import {
  filterQuickActionsForOrchestrationStage,
  normalizeQuickRepliesToActions,
  quickActionsToLabels,
  type QuickAction,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ServiceFlowTransitionSignal } from "@/lib/requirements/serviceFlowStageTransition";

/** Phase 14 canonical stages (wire + forward-compat logical stages). */
export type OrchestrationStage = RequirementsOrchestrationStageWire | "SERVICE_FLOW" | "SCREEN_DEFINE" | "PROTOTYPE" | "REVIEW";

export type OrchestrationStageDefinition = Readonly<{
  readonly wireStage: RequirementsOrchestrationStageWire | null;
  readonly workspaceStage: RequirementsWorkspaceStage;
  readonly conversationState: ServiceFlowConversationState | null;
  readonly allowedTransitions: readonly OrchestrationStage[];
  readonly rollbackTransitions: readonly OrchestrationStage[];
  readonly allowedActionIds: readonly QuickActionId[];
  readonly obsoleteActionIds: readonly QuickActionId[];
}>;

const STAGE_REGISTRY: Record<OrchestrationStage, OrchestrationStageDefinition> = {
  PRODUCT_DEFINITION: {
    wireStage: "PRODUCT_DEFINITION",
    workspaceStage: "product-definition",
    conversationState: null,
    allowedTransitions: ["IDEATION"],
    rollbackTransitions: [],
    allowedActionIds: [],
    obsoleteActionIds: [
      "APPROVE_FLOW",
      "NEXT_STAGE",
      "START_FEATURE_DETAIL",
      "APPLY_PROPOSAL",
      "GENERATE_ALTERNATIVE",
    ],
  },
  IDEATION: {
    wireStage: "IDEATION",
    workspaceStage: "ideation",
    conversationState: null,
    allowedTransitions: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW"],
    rollbackTransitions: [],
    allowedActionIds: [],
    obsoleteActionIds: [
      "APPROVE_FLOW",
      "NEXT_STAGE",
      "START_FEATURE_DETAIL",
      "APPLY_PROPOSAL",
      "GENERATE_ALTERNATIVE",
    ],
  },
  SERVICE_FLOW: {
    wireStage: "SERVICE_FLOW_REVIEW",
    workspaceStage: "service-flow",
    conversationState: "PROPOSAL",
    allowedTransitions: ["SERVICE_FLOW_REVIEW", "FEATURE_DETAIL", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["IDEATION"],
    allowedActionIds: ["APPLY_PROPOSAL", "REVIEW_FLOW", "GENERATE_ALTERNATIVE", "PARTIAL_EDIT", "DIRECT_INPUT", "HOLD"],
    obsoleteActionIds: [
      "EDIT_FEATURES",
      "DEFINE_SCREEN",
      "DEFINE_API",
      "GENERATE_DOCUMENT",
      "DOCUMENT_FLOW",
      "COMPLETE_DOCUMENTATION",
      "VIEW_ALTERNATIVE_DETAIL",
    ],
  },
  SERVICE_FLOW_REVIEW: {
    wireStage: "SERVICE_FLOW_REVIEW",
    workspaceStage: "service-flow",
    conversationState: "REVIEW",
    allowedTransitions: ["FEATURE_DETAIL", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["SERVICE_FLOW"],
    allowedActionIds: [
      "REVIEW_FLOW",
      "APPROVE_FLOW",
      "EDIT_STEPS",
      "ADD_ACTOR",
      "START_FEATURE_DETAIL",
    ],
    obsoleteActionIds: [
      "APPLY_PROPOSAL",
      "GENERATE_ALTERNATIVE",
      "EDIT_FEATURES",
      "DEFINE_API",
      "DOCUMENT_FLOW",
      "COMPLETE_DOCUMENTATION",
      "VIEW_ALTERNATIVE_DETAIL",
      "APPLY_ALTERNATIVE",
      "KEEP_PRIMARY",
      "REGENERATE_ALTERNATIVE",
    ],
  },
  FEATURE_DETAIL: {
    wireStage: "FEATURE_DETAIL",
    workspaceStage: "feature-planning",
    conversationState: "FEATURE_DETAIL",
    allowedTransitions: ["SCREEN_DEFINE", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["SERVICE_FLOW_REVIEW"],
    allowedActionIds: ["EDIT_FEATURES", "DEFINE_SCREEN", "DEFINE_API", "OPEN_ARTIFACT_HUB", "OPEN_CANVAS"],
    obsoleteActionIds: [
      "APPROVE_FLOW",
      "REVIEW_FLOW",
      "APPLY_PROPOSAL",
      "NEXT_STAGE",
      "GENERATE_ALTERNATIVE",
      "VIEW_ALTERNATIVE_DETAIL",
      "APPLY_ALTERNATIVE",
      "KEEP_PRIMARY",
      "REGENERATE_ALTERNATIVE",
      "EDIT_STEPS",
      "ADD_ACTOR",
      "START_FEATURE_DETAIL",
      "DOCUMENT_FLOW",
      "COMPLETE_DOCUMENTATION",
    ],
  },
  DOCUMENTATION_COMPLETE: {
    wireStage: "DOCUMENTATION_COMPLETE",
    workspaceStage: "service-flow",
    conversationState: "APPROVED",
    allowedTransitions: ["FEATURE_DETAIL"],
    rollbackTransitions: ["SERVICE_FLOW_REVIEW"],
    allowedActionIds: ["START_FEATURE_DETAIL", "EDIT_STEPS"],
    obsoleteActionIds: ["APPROVE_FLOW", "APPLY_PROPOSAL", "DOCUMENT_FLOW", "COMPLETE_DOCUMENTATION"],
  },
  SCREEN_DEFINE: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: "FEATURE_DETAIL",
    allowedTransitions: ["PROTOTYPE", "REVIEW"],
    rollbackTransitions: ["FEATURE_DETAIL"],
    allowedActionIds: ["DEFINE_SCREEN", "DEFINE_API", "EDIT_FEATURES"],
    obsoleteActionIds: ["APPROVE_FLOW"],
  },
  PROTOTYPE: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: null,
    allowedTransitions: ["REVIEW"],
    rollbackTransitions: ["SCREEN_DEFINE"],
    allowedActionIds: [],
    obsoleteActionIds: ["APPROVE_FLOW", "APPLY_PROPOSAL"],
  },
  REVIEW: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: null,
    allowedTransitions: ["DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["PROTOTYPE"],
    allowedActionIds: [],
    obsoleteActionIds: [],
  },
};

export function getOrchestrationStageDefinition(stage: OrchestrationStage): OrchestrationStageDefinition {
  return STAGE_REGISTRY[stage];
}

export function isOrchestrationTransitionAllowed(
  from: OrchestrationStage,
  to: OrchestrationStage,
): boolean {
  return STAGE_REGISTRY[from].allowedTransitions.includes(to);
}

/** Authoritative stage from persisted orchestration state (not chat/canvas/timeline). */
export function resolveAuthoritativeOrchestrationStage(
  state: RequirementsStateJson,
): OrchestrationStage {
  const activePhase = String(state.requirementsOrchestrationStageV1?.activePhase ?? "").trim();
  if (activePhase === "screen_define") return "SCREEN_DEFINE";
  if (activePhase === "api_define") return "FEATURE_DETAIL";

  const stored = state.requirementsOrchestrationStageV1?.currentStage;
  if (stored === "PRODUCT_DEFINITION") return "PRODUCT_DEFINITION";
  if (stored === "FEATURE_DETAIL") return "FEATURE_DETAIL";
  if (stored === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (stored === "SERVICE_FLOW_REVIEW") return "SERVICE_FLOW_REVIEW";
  if (stored === "IDEATION") return "IDEATION";

  const conv = state.serviceFlowV1 ? resolveServiceFlowConversationState(state.serviceFlowV1) : null;
  if (conv === "FEATURE_DETAIL") return "FEATURE_DETAIL";
  if (state.featureDetailSlotsV1?.slots?.length) return "FEATURE_DETAIL";
  if (state.featurePlanningSlotsV1?.slots?.length) return "FEATURE_DETAIL";

  if (conv === "APPROVED" || state.serviceFlowV1?.flowApproved) return "SERVICE_FLOW_REVIEW";
  if (conv === "REVIEW") return "SERVICE_FLOW_REVIEW";
  if (state.serviceFlowV1?.steps?.length || state.serviceFlowV1?.actors?.length) {
    return conv === "PROPOSAL" ? "SERVICE_FLOW" : "SERVICE_FLOW_REVIEW";
  }

  return "IDEATION";
}

export function workspaceStageFromOrchestrationStage(stage: OrchestrationStage): RequirementsWorkspaceStage {
  return STAGE_REGISTRY[stage].workspaceStage;
}

export function wireStageForOrchestrationStage(stage: OrchestrationStage): RequirementsOrchestrationStageWire | null {
  return STAGE_REGISTRY[stage].wireStage;
}

export function orchestrationStageFromTransitionTarget(
  signal: ServiceFlowTransitionSignal,
): OrchestrationStage {
  if (signal === "FEATURE_DETAIL_START" || signal === "NEXT_STAGE") return "FEATURE_DETAIL";
  if (signal === "SCREEN_DEFINE_START") return "SCREEN_DEFINE";
  if (signal === "API_DEFINE_START") return "FEATURE_DETAIL";
  if (signal === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (signal === "APPROVE_FLOW") return "SERVICE_FLOW_REVIEW";
  return "SERVICE_FLOW_REVIEW";
}

export function filterQuickActionsForStage(
  stage: OrchestrationStage,
  actions: readonly QuickAction[],
): readonly QuickAction[] {
  const def = STAGE_REGISTRY[stage];
  return filterQuickActionsForOrchestrationStage(stage, actions, {
    allowedActionIds: def.allowedActionIds,
    obsoleteActionIds: def.obsoleteActionIds,
  });
}

/** @deprecated use filterQuickActionsForStage — label-only compat for legacy callers */
export function filterQuickRepliesForOrchestrationStage(
  stage: OrchestrationStage,
  replies: readonly string[],
): readonly string[] {
  const actions = normalizeQuickRepliesToActions(replies);
  return quickActionsToLabels(filterQuickActionsForStage(stage, actions));
}
