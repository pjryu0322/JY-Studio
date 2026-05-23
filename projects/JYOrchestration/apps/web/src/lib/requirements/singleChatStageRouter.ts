/**
 * Project SingleChat — stage intent routing (service-flow / review / screen / feature / generation).
 * CTA label exact-match only; semantic stageIntent comes from LLM Router metadata.
 */

import {
  isProjectSingleChatScope,
  type ConversationExecutionScope,
} from "@/lib/conversation/conversationScopeBoundary";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { resolveQuickActionIdFromLegacyLabel } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  recentMessagesHasPriorAdviceResponse,
  serviceFlowHasMinimumDraftForApply,
} from "@/lib/requirements/serviceFlowAdviceApplyMode";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import { normalizeExecutionIntent } from "@/lib/requirements/requirementsIntentRouterTypes";

export type ProjectSingleChatStageIntent =
  | "service_flow"
  | "flow_review"
  | "screen_planning"
  | "feature_planning"
  | "generation_prepare"
  | "general_advice";

export type ProjectSingleChatCtaId =
  | "FLOW_REVIEW"
  | "SCREEN_PLANNING"
  | "FEATURE_PLANNING"
  | "GENERATION_PREPARE";

const STAGE_INTENTS = new Set<ProjectSingleChatStageIntent>([
  "service_flow",
  "flow_review",
  "screen_planning",
  "feature_planning",
  "generation_prepare",
  "general_advice",
]);

export type ProjectSingleChatStageRoutingResult = Readonly<{
  readonly stageIntent: ProjectSingleChatStageIntent;
  readonly shouldRunServiceFlowAnalyze: boolean;
  readonly shouldRunAdviceToFlowApply: boolean;
  readonly shouldRunFlowReview: boolean;
  readonly shouldRouteToScreenPlanning: boolean;
  readonly shouldRouteToFeaturePlanning: boolean;
  readonly shouldRouteToGenerationPrepare: boolean;
  readonly reason: string;
}>;

export function normalizeProjectSingleChatStageIntent(
  raw?: string | null,
): ProjectSingleChatStageIntent {
  const v = String(raw ?? "").trim() as ProjectSingleChatStageIntent;
  return STAGE_INTENTS.has(v) ? v : "general_advice";
}

/** Chip / CTA 클릭과 동일한 exact label 매핑 (의도 정규식 아님). */
export function resolveProjectSingleChatCtaId(input: {
  readonly directCtaId?: ProjectSingleChatCtaId | string | null;
  readonly quickActionId?: QuickActionId | string | null;
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  /** typed_text에서 userMessage exact label → CTA 매핑 (기본 false) */
  readonly allowUserMessageLegacyCtaMatch?: boolean;
}): ProjectSingleChatCtaId | null {
  const explicit = String(input.directCtaId ?? "").trim();
  if (explicit === "FLOW_REVIEW") return "FLOW_REVIEW";
  if (explicit === "SCREEN_PLANNING") return "SCREEN_PLANNING";
  if (explicit === "FEATURE_PLANNING") return "FEATURE_PLANNING";
  if (explicit === "GENERATION_PREPARE") return "GENERATION_PREPARE";

  const fromId = String(input.quickActionId ?? "").trim();
  if (fromId === "REVIEW_FLOW") return "FLOW_REVIEW";
  if (fromId === "DEFINE_SCREEN") return "SCREEN_PLANNING";
  if (fromId === "EDIT_FEATURES") return "FEATURE_PLANNING";
  if (fromId === "START_FEATURE_DETAIL") return "FEATURE_PLANNING";

  const labelFromChip = String(input.quickActionLabel ?? "").trim();
  if (labelFromChip) {
    const legacyFromChip = resolveQuickActionIdFromLegacyLabel(labelFromChip);
    if (legacyFromChip === "REVIEW_FLOW") return "FLOW_REVIEW";
    if (legacyFromChip === "DEFINE_SCREEN") return "SCREEN_PLANNING";
    if (legacyFromChip === "EDIT_FEATURES" || legacyFromChip === "START_FEATURE_DETAIL") {
      return "FEATURE_PLANNING";
    }
  }

  if (input.allowUserMessageLegacyCtaMatch) {
    const legacyFromMessage = resolveQuickActionIdFromLegacyLabel(
      String(input.userMessage ?? "").trim(),
    );
    if (legacyFromMessage === "REVIEW_FLOW") return "FLOW_REVIEW";
    if (legacyFromMessage === "DEFINE_SCREEN") return "SCREEN_PLANNING";
    if (legacyFromMessage === "EDIT_FEATURES" || legacyFromMessage === "START_FEATURE_DETAIL") {
      return "FEATURE_PLANNING";
    }
  }

  return null;
}

function resolveStageIntentFromSignals(input: {
  readonly routerStageIntent?: string | null;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
  readonly effectiveActionId?: QuickActionId | null;
}): ProjectSingleChatStageIntent {
  if (input.directCtaId === "FLOW_REVIEW") return "flow_review";
  if (input.directCtaId === "SCREEN_PLANNING") return "screen_planning";
  if (input.directCtaId === "FEATURE_PLANNING") return "feature_planning";
  if (input.directCtaId === "GENERATION_PREPARE") return "generation_prepare";

  const fromRouter = normalizeProjectSingleChatStageIntent(input.routerStageIntent);
  if (fromRouter !== "general_advice") return fromRouter;

  if (input.effectiveActionId === "REVIEW_FLOW") return "flow_review";
  if (input.effectiveActionId === "DEFINE_SCREEN") return "screen_planning";
  if (
    input.effectiveActionId === "EDIT_FEATURES" ||
    input.effectiveActionId === "START_FEATURE_DETAIL"
  ) {
    return "feature_planning";
  }

  return "general_advice";
}

export function routeProjectSingleChatStage(input: {
  readonly executionScope: ConversationExecutionScope;
  readonly currentStage?: string;
  readonly latestUserMessage: string;
  readonly latestAiMessage?: string | null;
  readonly effectiveActionId?: QuickActionId | null;
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly routerIntentType?: string | null;
  readonly routerExecutionIntent?: string | null;
  readonly routerStageIntent?: string | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
  readonly recentMessages?: string;
}): ProjectSingleChatStageRoutingResult {
  if (!isProjectSingleChatScope(input.executionScope)) {
    return {
      stageIntent: "general_advice",
      shouldRunServiceFlowAnalyze: false,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "not_project_single_chat",
    };
  }

  const stageIntent = resolveStageIntentFromSignals({
    routerStageIntent: input.routerStageIntent,
    directCtaId: input.directCtaId,
    effectiveActionId: input.effectiveActionId,
  });
  const hasMinDraft = serviceFlowHasMinimumDraftForApply(input.currentFlow);
  const executionIntent = normalizeExecutionIntent(input.routerExecutionIntent);
  const recent = String(input.recentMessages ?? "");

  if (stageIntent === "screen_planning") {
    return {
      stageIntent: "screen_planning",
      shouldRunServiceFlowAnalyze: false,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: true,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "router_stage_screen_planning",
    };
  }

  if (stageIntent === "feature_planning") {
    return {
      stageIntent: "feature_planning",
      shouldRunServiceFlowAnalyze: false,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: true,
      shouldRouteToGenerationPrepare: false,
      reason: "router_stage_feature_planning",
    };
  }

  if (stageIntent === "generation_prepare") {
    return {
      stageIntent: "generation_prepare",
      shouldRunServiceFlowAnalyze: false,
      shouldRunAdviceToFlowApply: !hasMinDraft && recentMessagesHasPriorAdviceResponse(recent),
      shouldRunFlowReview: false,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: true,
      reason: hasMinDraft ? "generation_prepare_readiness" : "generation_prepare_needs_flow_draft",
    };
  }

  if (stageIntent === "flow_review") {
    if (!hasMinDraft) {
      const canAdviceToFlow =
        recentMessagesHasPriorAdviceResponse(recent) ||
        input.proposalDecision === "APPLY" ||
        input.directQuickActionId === "APPLY_PROPOSAL";
      return {
        stageIntent: "service_flow",
        shouldRunServiceFlowAnalyze: true,
        shouldRunAdviceToFlowApply: canAdviceToFlow,
        shouldRunFlowReview: false,
        shouldRouteToScreenPlanning: false,
        shouldRouteToFeaturePlanning: false,
        shouldRouteToGenerationPrepare: false,
        reason: "flow_review_blocked_empty_steps",
      };
    }
    return {
      stageIntent: "flow_review",
      shouldRunServiceFlowAnalyze: true,
      shouldRunAdviceToFlowApply: false,
      shouldRunFlowReview: true,
      shouldRouteToScreenPlanning: false,
      shouldRouteToFeaturePlanning: false,
      shouldRouteToGenerationPrepare: false,
      reason: "flow_review_with_draft",
    };
  }

  const treatAsServiceFlow =
    stageIntent === "service_flow" ||
    executionIntent === "explicit_execute" ||
    input.proposalDecision === "APPLY" ||
    input.proposalDecision === "PARTIAL_EDIT" ||
    input.proposalDecision === "DIRECT_INPUT";

  return {
    stageIntent: treatAsServiceFlow ? "service_flow" : "general_advice",
    shouldRunServiceFlowAnalyze: treatAsServiceFlow || executionIntent === "ask_advice",
    shouldRunAdviceToFlowApply: false,
    shouldRunFlowReview: false,
    shouldRouteToScreenPlanning: false,
    shouldRouteToFeaturePlanning: false,
    shouldRouteToGenerationPrepare: false,
    reason: treatAsServiceFlow ? "service_flow_default" : "general_advice",
  };
}
