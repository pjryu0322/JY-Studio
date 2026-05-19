/**
 * Runtime orchestration stage registry — authoritative stage graph (not UI string compares).
 */

import type { RequirementsOrchestrationStageWire, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import {
  resolveServiceFlowConversationState,
  type ServiceFlowConversationState,
} from "@/lib/requirements/serviceFlowConversationState";
import type { ServiceFlowTransitionSignal } from "@/lib/requirements/serviceFlowStageTransition";

/** Phase 14 canonical stages (wire + forward-compat logical stages). */
export type OrchestrationStage = RequirementsOrchestrationStageWire | "SERVICE_FLOW" | "SCREEN_DEFINE" | "PROTOTYPE" | "REVIEW";

export type OrchestrationTransitionSignalType =
  | ServiceFlowTransitionSignal
  | "APPLY"
  | "REVIEW_FLOW"
  | "PARTIAL_EDIT";

export type OrchestrationStageDefinition = Readonly<{
  readonly wireStage: RequirementsOrchestrationStageWire | null;
  readonly workspaceStage: RequirementsWorkspaceStage;
  readonly conversationState: ServiceFlowConversationState | null;
  readonly allowedTransitions: readonly OrchestrationStage[];
  readonly rollbackTransitions: readonly OrchestrationStage[];
  readonly allowedQuickReplyPatterns: readonly RegExp[];
  readonly obsoleteQuickReplyPatterns: readonly RegExp[];
}>;

const STAGE_REGISTRY: Record<OrchestrationStage, OrchestrationStageDefinition> = {
  IDEATION: {
    wireStage: "IDEATION",
    workspaceStage: "ideation",
    conversationState: null,
    allowedTransitions: ["SERVICE_FLOW", "SERVICE_FLOW_REVIEW"],
    rollbackTransitions: [],
    allowedQuickReplyPatterns: [],
    obsoleteQuickReplyPatterns: [/흐름\s*승인/, /다음\s*단계/, /세부\s*기능/],
  },
  SERVICE_FLOW: {
    wireStage: "SERVICE_FLOW_REVIEW",
    workspaceStage: "service-flow",
    conversationState: "PROPOSAL",
    allowedTransitions: ["SERVICE_FLOW_REVIEW", "FEATURE_DETAIL", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["IDEATION"],
    allowedQuickReplyPatterns: [/추천안\s*적용/, /흐름\s*검토/, /다른\s*대안/],
    obsoleteQuickReplyPatterns: [/기능\s*수정/, /화면\s*정의/],
  },
  SERVICE_FLOW_REVIEW: {
    wireStage: "SERVICE_FLOW_REVIEW",
    workspaceStage: "service-flow",
    conversationState: "REVIEW",
    allowedTransitions: ["FEATURE_DETAIL", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["SERVICE_FLOW"],
    allowedQuickReplyPatterns: [/흐름\s*승인/, /흐름\s*검토/, /세부\s*기능/, /단계\s*수정/],
    obsoleteQuickReplyPatterns: [/기능\s*수정/, /API\s*정의/],
  },
  FEATURE_DETAIL: {
    wireStage: "FEATURE_DETAIL",
    workspaceStage: "feature-planning",
    conversationState: "FEATURE_DETAIL",
    allowedTransitions: ["SCREEN_DEFINE", "DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["SERVICE_FLOW_REVIEW"],
    allowedQuickReplyPatterns: [/기능\s*수정/, /화면\s*정의/, /API\s*정의/, /문서\s*생성/],
    obsoleteQuickReplyPatterns: [/흐름\s*승인/, /다음\s*단계\s*진행/, /추천안\s*적용/, /흐름\s*검토/],
  },
  DOCUMENTATION_COMPLETE: {
    wireStage: "DOCUMENTATION_COMPLETE",
    workspaceStage: "service-flow",
    conversationState: "APPROVED",
    allowedTransitions: ["FEATURE_DETAIL"],
    rollbackTransitions: ["SERVICE_FLOW_REVIEW"],
    allowedQuickReplyPatterns: [/세부\s*기능/, /문서/],
    obsoleteQuickReplyPatterns: [/흐름\s*승인/, /추천안\s*적용/],
  },
  SCREEN_DEFINE: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: "FEATURE_DETAIL",
    allowedTransitions: ["PROTOTYPE", "REVIEW"],
    rollbackTransitions: ["FEATURE_DETAIL"],
    allowedQuickReplyPatterns: [/화면/, /API/],
    obsoleteQuickReplyPatterns: [/흐름\s*승인/],
  },
  PROTOTYPE: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: null,
    allowedTransitions: ["REVIEW"],
    rollbackTransitions: ["SCREEN_DEFINE"],
    allowedQuickReplyPatterns: [],
    obsoleteQuickReplyPatterns: [/흐름\s*승인/, /추천안\s*적용/],
  },
  REVIEW: {
    wireStage: null,
    workspaceStage: "feature-planning",
    conversationState: null,
    allowedTransitions: ["DOCUMENTATION_COMPLETE"],
    rollbackTransitions: ["PROTOTYPE"],
    allowedQuickReplyPatterns: [],
    obsoleteQuickReplyPatterns: [],
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
  const stored = state.requirementsOrchestrationStageV1?.currentStage;
  if (stored === "FEATURE_DETAIL") return "FEATURE_DETAIL";
  if (stored === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (stored === "SERVICE_FLOW_REVIEW") return "SERVICE_FLOW_REVIEW";
  if (stored === "IDEATION") return "IDEATION";

  const conv = state.serviceFlowV1 ? resolveServiceFlowConversationState(state.serviceFlowV1) : null;
  if (conv === "FEATURE_DETAIL") return "FEATURE_DETAIL";
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
  if (signal === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (signal === "APPROVE_FLOW") return "SERVICE_FLOW_REVIEW";
  return "SERVICE_FLOW_REVIEW";
}

export function filterQuickRepliesForOrchestrationStage(
  stage: OrchestrationStage,
  replies: readonly string[],
): readonly string[] {
  const def = STAGE_REGISTRY[stage];
  return replies.filter((label) => {
    const s = String(label ?? "").trim();
    if (!s) return false;
    if (def.obsoleteQuickReplyPatterns.some((re) => re.test(s))) return false;
    return true;
  });
}

export function isQuickReplyAllowedForStage(stage: OrchestrationStage, label: string): boolean {
  const s = String(label ?? "").trim();
  if (!s) return false;
  const def = STAGE_REGISTRY[stage];
  if (def.obsoleteQuickReplyPatterns.some((re) => re.test(s))) return false;
  if (!def.allowedQuickReplyPatterns.length) return true;
  return def.allowedQuickReplyPatterns.some((re) => re.test(s));
}
