/**
 * Projection layer — UI reads derived views, not raw authoritative state directly.
 */

import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import {
  filterQuickActionsForStage,
  resolveAuthoritativeOrchestrationStage,
  workspaceStageFromOrchestrationStage,
  type OrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  filterFeatureDetailQuickActions,
  projectFeatureDetailMetrics,
  type FeatureDetailProjectionMetrics,
} from "@/lib/requirements/featureDetailSlots";
import { filterQuickActionsForChatProjection } from "@/lib/requirements/requirementsQuickActionPolicy";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  quickActionsForConversationState,
  quickActionsToLabels,
  type QuickAction,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  quickReplyProfileForState,
  resolveServiceFlowConversationState,
} from "@/lib/requirements/serviceFlowConversationState";
import {
  buildOrchestrationSlotSummarySections,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationConfirmedProgress,
  singleChatOrchestrationStatusCounts,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type RequirementsOrchestrationProjection = Readonly<{
  readonly authoritativeStage: OrchestrationStage;
  readonly workspaceStage: RequirementsWorkspaceStage;
  readonly orchestrationUiState: RequirementsSingleChatOrchestrationStateV1;
  readonly orchestrationAligned: boolean;
  readonly progress: ReturnType<typeof singleChatOrchestrationWeightedProgress>;
  readonly progressConfirmed: ReturnType<typeof singleChatOrchestrationConfirmedProgress>;
  readonly statusCounts: ReturnType<typeof singleChatOrchestrationStatusCounts>;
  readonly slotSections: ReturnType<typeof buildOrchestrationSlotSummarySections>;
  readonly quickActions: readonly QuickAction[];
  readonly quickReplies: readonly string[];
  readonly quickReplyProfile: string;
  readonly conversationState: ReturnType<typeof resolveServiceFlowConversationState> | null;
  readonly featureDetail: FeatureDetailProjectionMetrics;
}>;

export function resolveOrchestrationUiState(input: {
  readonly state: RequirementsStateJson;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso?: string;
}): { readonly uiState: RequirementsSingleChatOrchestrationStateV1; readonly aligned: boolean } {
  const hash = hashSlotDefinitions(input.slotDefinitions);
  const orch = input.state.singleChatOrchestrationV1 ?? null;
  if (orch && orch.slotDefinitionsHash === hash) {
    return { uiState: orch, aligned: true };
  }
  const now = input.nowIso ?? new Date().toISOString();
  return {
    uiState: initialOrchestrationStateFromDefinitions(input.slotDefinitions, now),
    aligned: false,
  };
}

export function buildProgressProjection(
  orchestrationUiState: RequirementsSingleChatOrchestrationStateV1,
): ReturnType<typeof singleChatOrchestrationWeightedProgress> {
  return singleChatOrchestrationWeightedProgress(orchestrationUiState);
}

export function buildQuickReplyProjection(input: {
  readonly state: RequirementsStateJson;
  readonly authoritativeStage: OrchestrationStage;
}): {
  readonly quickActions: readonly QuickAction[];
  readonly quickReplies: readonly string[];
  readonly quickReplyProfile: string;
  readonly featureDetail: FeatureDetailProjectionMetrics;
} {
  const conv = input.state.serviceFlowV1
    ? resolveServiceFlowConversationState(input.state.serviceFlowV1)
    : "PROPOSAL";
  const profile = quickReplyProfileForState(conv);
  const raw = quickActionsForConversationState(conv);
  const featureDetail = projectFeatureDetailMetrics(input.state.featureDetailSlotsV1);
  const activePhase = input.state.requirementsOrchestrationStageV1?.activePhase ?? null;
  const stageFiltered = filterQuickActionsForStage(input.authoritativeStage, raw);
  const postApproveBlocked = new Set<QuickActionId>(["APPROVE_FLOW", "REVIEW_FLOW", "APPLY_PROPOSAL"]);
  const afterApproveFilter =
    conv === "APPROVED" || conv === "FEATURE_DETAIL" ?
      stageFiltered.filter((a) => !postApproveBlocked.has(a.id))
    : stageFiltered;
  const stageQuickActions =
    conv === "FEATURE_DETAIL" ?
      filterFeatureDetailQuickActions({
        actions: afterApproveFilter,
        metrics: featureDetail,
        stage: input.authoritativeStage,
        activePhase,
      })
    : afterApproveFilter;
  const quickActions = filterQuickActionsForChatProjection(stageQuickActions);
  return {
    quickActions,
    quickReplies: quickActionsToLabels(quickActions),
    quickReplyProfile: profile,
    featureDetail,
  };
}

export function projectRequirementsOrchestrationView(input: {
  readonly state: RequirementsStateJson;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso?: string;
}): RequirementsOrchestrationProjection {
  const authoritativeStage = resolveAuthoritativeOrchestrationStage(input.state);
  const workspaceStage = workspaceStageFromOrchestrationStage(authoritativeStage);
  const { uiState, aligned } = resolveOrchestrationUiState({
    state: input.state,
    slotDefinitions: input.slotDefinitions,
    nowIso: input.nowIso,
  });
  const progress = buildProgressProjection(uiState);
  const progressConfirmed = singleChatOrchestrationConfirmedProgress(uiState);
  const statusCounts = singleChatOrchestrationStatusCounts(uiState);
  const slotSections = buildOrchestrationSlotSummarySections(input.slotDefinitions, uiState);
  const { quickActions, quickReplies, quickReplyProfile, featureDetail } = buildQuickReplyProjection({
    state: input.state,
    authoritativeStage,
  });
  const conversationState = input.state.serviceFlowV1
    ? resolveServiceFlowConversationState(input.state.serviceFlowV1)
    : null;

  return {
    authoritativeStage,
    workspaceStage,
    orchestrationUiState: uiState,
    orchestrationAligned: aligned,
    progress,
    progressConfirmed,
    statusCounts,
    slotSections,
    quickActions,
    quickReplies,
    quickReplyProfile,
    conversationState,
    featureDetail,
  };
}
