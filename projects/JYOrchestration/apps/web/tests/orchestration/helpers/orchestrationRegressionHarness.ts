/**
 * Phase15 — deterministic orchestration regression helpers (state/signal/projection only).
 */

import type { RequirementsServiceFlowV1, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowConversationState } from "@/lib/requirements/serviceFlowConversationState";
import { appendOrchestrationTransitionTimelineExtras } from "@/lib/requirements/requirementsOrchestrationTimeline";
import {
  filterQuickActionsForStage,
  getOrchestrationStageDefinition,
  isOrchestrationTransitionAllowed,
  resolveAuthoritativeOrchestrationStage,
  type OrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  buildQuickReplyProjection,
  projectRequirementsOrchestrationView,
  type RequirementsOrchestrationProjection,
} from "@/lib/requirements/requirementsOrchestrationProjection";
import {
  normalizeQuickRepliesToActions,
  type QuickAction,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import {
  applyRequirementsOrchestrationTransition,
  type RequirementsTransitionResult,
} from "@/lib/requirements/requirementsTransitionEngine";
import type { ServiceFlowStageTransitionMeta } from "@/lib/requirements/serviceFlowStageTransition";
import {
  buildDynamicServicePlanningSlotDefinitions,
  type SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationSlots";

export const ORCHESTRATION_REGRESSION_NOW = "2026-05-19T12:00:00.000Z" as const;

export const FEATURE_DETAIL_ALLOWED_ACTION_IDS: readonly QuickActionId[] = [
  "EDIT_FEATURES",
  "DEFINE_SCREEN",
  "DEFINE_API",
  "GENERATE_DOCUMENT",
];

export const FEATURE_DETAIL_OBSOLETE_ACTION_IDS: readonly QuickActionId[] = [
  "APPROVE_FLOW",
  "REVIEW_FLOW",
  "APPLY_PROPOSAL",
  "GENERATE_ALTERNATIVE",
];

export function createDefaultSlotDefinitions(): readonly SingleChatOrchestrationSlotDefinition[] {
  return buildDynamicServicePlanningSlotDefinitions({
    projectName: "regression",
    projectDescription: "",
    projectType: null,
    servicePlanningAgentCatalogKeys: null,
  });
}

export function createSampleServiceFlow(
  overrides?: Partial<RequirementsServiceFlowV1>,
): RequirementsServiceFlowV1 {
  return {
    createdAt: ORCHESTRATION_REGRESSION_NOW,
    updatedAt: ORCHESTRATION_REGRESSION_NOW,
    actors: [
      { id: "a1", name: "User", kind: "human", description: "" },
      { id: "a2", name: "System", kind: "system", description: "" },
    ],
    steps: [
      {
        id: "s1",
        title: "Upload",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: ORCHESTRATION_REGRESSION_NOW,
      },
      {
        id: "s2",
        title: "Analyze",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: ORCHESTRATION_REGRESSION_NOW,
      },
    ],
    ...overrides,
  };
}

export function conversationStateForOrchestrationStage(
  stage: OrchestrationStage,
): ServiceFlowConversationState {
  if (stage === "FEATURE_DETAIL" || stage === "SCREEN_DEFINE" || stage === "PROTOTYPE") {
    return "FEATURE_DETAIL";
  }
  if (stage === "DOCUMENTATION_COMPLETE") return "APPROVED";
  if (stage === "SERVICE_FLOW") return "PROPOSAL";
  if (stage === "IDEATION") return "PROPOSAL";
  return "REVIEW";
}

export function createMockOrchestrationState(input?: {
  readonly stage?: OrchestrationStage;
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly completedStages?: readonly OrchestrationStage[];
}): RequirementsStateJson {
  const stage = input?.stage ?? "SERVICE_FLOW_REVIEW";
  const conv = conversationStateForOrchestrationStage(stage);
  const flow =
    input?.flow === null
      ? null
      : {
          ...(input?.flow ?? createSampleServiceFlow()),
          conversationState: input?.flow?.conversationState ?? conv,
        };
  const wireStage =
    stage === "FEATURE_DETAIL"
      ? "FEATURE_DETAIL"
      : stage === "DOCUMENTATION_COMPLETE"
        ? "DOCUMENTATION_COMPLETE"
        : stage === "IDEATION"
          ? "IDEATION"
          : stage === "SERVICE_FLOW"
            ? "SERVICE_FLOW_REVIEW"
            : "SERVICE_FLOW_REVIEW";

  return {
    serviceFlowV1: flow,
    requirementsOrchestrationStageV1: {
      currentStage: wireStage,
      completedStages: [...(input?.completedStages ?? [])],
      activePhase: wireStage,
      updatedAt: ORCHESTRATION_REGRESSION_NOW,
    },
  };
}

export function dispatchQuickAction(input: {
  readonly state: RequirementsStateJson;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly quickActionId: QuickActionId;
  readonly quickActionLabel?: string;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): RequirementsTransitionResult {
  return applyRequirementsOrchestrationTransition({
    state: input.state,
    currentFlow: input.currentFlow,
    proposalDecision: null,
    quickActionId: input.quickActionId,
    quickActionLabel: input.quickActionLabel,
    slotDefinitions: input.slotDefinitions ?? createDefaultSlotDefinitions(),
    nowIso: ORCHESTRATION_REGRESSION_NOW,
  });
}

export function buildProjection(input: {
  readonly state: RequirementsStateJson;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): RequirementsOrchestrationProjection {
  return projectRequirementsOrchestrationView({
    state: input.state,
    slotDefinitions: input.slotDefinitions ?? createDefaultSlotDefinitions(),
    nowIso: ORCHESTRATION_REGRESSION_NOW,
  });
}

export function buildQuickActionProjection(input: {
  readonly state: RequirementsStateJson;
  readonly stage?: OrchestrationStage;
}): ReturnType<typeof buildQuickReplyProjection> {
  const stage = input.stage ?? resolveAuthoritativeOrchestrationStage(input.state);
  return buildQuickReplyProjection({ state: input.state, authoritativeStage: stage });
}

export function assertAllowedActions(stage: OrchestrationStage, actions: readonly QuickAction[]): void {
  const def = getOrchestrationStageDefinition(stage);
  if (!def.allowedActionIds.length) return;
  const allowed = new Set(def.allowedActionIds);
  for (const action of actions) {
    if (!allowed.has(action.id)) {
      throw new Error(`action ${action.id} not allowed in stage ${stage}`);
    }
  }
}

export function assertObsoleteActionsRemoved(
  stage: OrchestrationStage,
  actions: readonly QuickAction[],
): void {
  const obsolete = new Set(getOrchestrationStageDefinition(stage).obsoleteActionIds);
  for (const action of actions) {
    if (obsolete.has(action.id)) {
      throw new Error(`obsolete action ${action.id} present in stage ${stage}`);
    }
  }
}

export function assertStageTransitionAllowed(from: OrchestrationStage, to: OrchestrationStage): void {
  if (!isOrchestrationTransitionAllowed(from, to)) {
    throw new Error(`transition not allowed: ${from} → ${to}`);
  }
}

export function assertApproveFlowOutcome(result: RequirementsTransitionResult): void {
  if (result.transitionResult !== "applied") {
    throw new Error(`expected applied, got ${result.transitionResult}`);
  }
  if (!result.transitionTriggered) {
    throw new Error("expected transitionTriggered=true");
  }
  const decision = (result.fastPath as { proposalDecision?: ServiceFlowProposalDecision } | null)
    ?.proposalDecision;
  if (decision !== "FLOW_APPROVE") {
    throw new Error(`expected FLOW_APPROVE proposalDecision, got ${String(decision)}`);
  }
}

export type OrchestrationTimelineMetadata = Readonly<{
  quickActionId?: string;
  quickActionLabel?: string;
  transitionSignal?: string;
  transitionTriggered?: boolean;
  fromStage?: string;
  toStage?: string;
  projectionUpdated?: boolean;
  slotSyncTriggered?: boolean;
  staleTriggered?: boolean;
}>;

export function buildTransitionTimelineMetadata(input: {
  readonly quickActionId: QuickActionId;
  readonly quickActionLabel: string;
  readonly transitionResult: RequirementsTransitionResult;
  readonly transitionMeta?: ServiceFlowStageTransitionMeta | null;
}): OrchestrationTimelineMetadata {
  return appendOrchestrationTransitionTimelineExtras({
    base: {
      quickActionId: input.quickActionId,
      quickActionLabel: input.quickActionLabel,
    },
    transitionMeta: input.transitionMeta ?? null,
    transitionEngine: input.transitionResult,
  }) as OrchestrationTimelineMetadata;
}

export function assertTimelineMetadata(
  meta: OrchestrationTimelineMetadata,
  required: readonly (keyof OrchestrationTimelineMetadata)[],
): void {
  for (const key of required) {
    if (meta[key] === undefined) {
      throw new Error(`missing timeline metadata: ${key}`);
    }
  }
}

export function projectionSnapshotSlice(projection: RequirementsOrchestrationProjection): Record<string, unknown> {
  return {
    authoritativeStage: projection.authoritativeStage,
    workspaceStage: projection.workspaceStage,
    quickActionIds: projection.quickActions.map((a) => a.id),
    quickReplyProfile: projection.quickReplyProfile,
    progressPercent: projection.progress.percent,
    progressWeighted: projection.progress.weightedScore,
    orchestrationAligned: projection.orchestrationAligned,
    statusCounts: projection.statusCounts,
  };
}

export function filterActionsForStage(
  stage: OrchestrationStage,
  wires: readonly { readonly id: QuickActionId; readonly label: string }[],
): readonly QuickAction[] {
  return filterQuickActionsForStage(stage, normalizeQuickRepliesToActions(wires));
}
