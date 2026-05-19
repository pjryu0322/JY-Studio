/**
 * Transition engine — Intent → Signal → Transition → State patch (not LLM-inferred state).
 */

import type { RequirementsStateJson, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  orchestrationStageFromTransitionTarget,
  resolveAuthoritativeOrchestrationStage,
  wireStageForOrchestrationStage,
  type OrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import {
  tryServiceFlowProposalDecisionFastPath,
  type ServiceFlowDecisionFastPathResult,
} from "@/lib/requirements/serviceFlowProposalDecision";
import {
  isQuickActionId,
  resolveProposalDecisionFromQuickActionInput,
  resolveTransitionSignalFromQuickActionInput,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  tryServiceFlowOrchestrationTransitionFastPath,
  type ServiceFlowStageTransitionFastPathResult,
  type ServiceFlowTransitionSignal,
} from "@/lib/requirements/serviceFlowStageTransition";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type RequirementsTransitionSignal = Readonly<{
  readonly type: string;
  readonly sourceStage: OrchestrationStage;
  readonly targetStage?: OrchestrationStage;
  readonly payload?: unknown;
}>;

export type RequirementsTransitionResult = Readonly<{
  readonly signal: RequirementsTransitionSignal | null;
  readonly fastPath: ServiceFlowStageTransitionFastPathResult | ServiceFlowDecisionFastPathResult | null;
  readonly transitionTriggered: boolean;
  readonly transitionResult: "applied" | "blocked" | "none";
  readonly requirementsStatePatch?: Partial<RequirementsStateJson>;
  readonly updatedFlow?: RequirementsServiceFlowV1;
  readonly projectionUpdated: boolean;
  readonly slotSyncTriggered: boolean;
  readonly staleTriggered: boolean;
  readonly invalidations: readonly string[];
}>;

export function resolveRequirementsTransitionSignal(input: {
  readonly state: RequirementsStateJson;
  readonly quickActionId?: string | null;
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
}): RequirementsTransitionSignal | null {
  const sourceStage = resolveAuthoritativeOrchestrationStage(input.state);
  const raw =
    resolveTransitionSignalFromQuickActionInput({
      quickActionId: input.quickActionId,
      proposalDecision: input.proposalDecision ?? null,
    }) ?? null;

  if (!raw) return null;

  const targetStage = orchestrationStageFromTransitionTarget(raw);
  const type = input.quickActionId && isQuickActionId(input.quickActionId) ? input.quickActionId : raw;
  return {
    type,
    sourceStage,
    targetStage,
    payload: {
      proposalDecision: input.proposalDecision ?? null,
      quickActionId: input.quickActionId ?? null,
    },
  };
}

export function applyRequirementsOrchestrationTransition(input: {
  readonly state: RequirementsStateJson;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly proposalDecision: ServiceFlowProposalDecision | null;
  readonly quickActionId?: string | null;
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  readonly projectName?: string;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly approvedBy?: string | null;
  readonly nowIso?: string;
}): RequirementsTransitionResult {
  const proposalDecision =
    input.proposalDecision ??
    resolveProposalDecisionFromQuickActionInput({
      quickActionId: input.quickActionId,
      quickActionLabel: input.quickActionLabel,
      userMessage: input.userMessage,
    });

  const signal = resolveRequirementsTransitionSignal({
    state: input.state,
    quickActionId: input.quickActionId,
    quickActionLabel: input.quickActionLabel,
    userMessage: input.userMessage,
    proposalDecision,
  });

  const transitionFastPath = tryServiceFlowOrchestrationTransitionFastPath({
    proposalDecision,
    quickActionId: input.quickActionId,
    currentFlow: input.currentFlow,
    projectName: input.projectName,
    slotDefinitions: input.slotDefinitions,
    orchestration: input.orchestration,
    existingFeaturePlanning: input.state.featurePlanningSlotsV1 ?? null,
    existingOrchestrationStage: input.state.requirementsOrchestrationStageV1 ?? null,
    approvedBy: input.approvedBy,
    nowIso: input.nowIso,
  });

  if (transitionFastPath) {
    const patch = transitionFastPath.requirementsStatePatch;
    return {
      signal,
      fastPath: transitionFastPath,
      transitionTriggered: Boolean(transitionFastPath.transitionMeta?.transitionTriggered),
      transitionResult: "applied",
      requirementsStatePatch: patch,
      updatedFlow: transitionFastPath.updatedFlow,
      projectionUpdated: Boolean(patch?.requirementsOrchestrationStageV1 || patch?.featurePlanningSlotsV1),
      slotSyncTriggered: Boolean(patch?.singleChatOrchestrationV1),
      staleTriggered: false,
      invalidations: [],
    };
  }

  const legacyDecisions = new Set<ServiceFlowProposalDecision>(["APPLY", "REVIEW_FLOW"]);
  const legacy =
    proposalDecision && legacyDecisions.has(proposalDecision)
      ? tryServiceFlowProposalDecisionFastPath({
          decision: proposalDecision,
          currentFlow: input.currentFlow,
          projectName: input.projectName,
          nowIso: input.nowIso,
        })
      : null;

  if (legacy) {
    return {
      signal,
      fastPath: legacy,
      transitionTriggered: false,
      transitionResult: "applied",
      updatedFlow: legacy.updatedFlow,
      projectionUpdated: false,
      slotSyncTriggered: false,
      staleTriggered: false,
      invalidations: [],
    };
  }

  const blocked =
    proposalDecision === "FLOW_APPROVE" ||
    proposalDecision === "FEATURE_DETAIL" ||
    proposalDecision === "NEXT_STAGE" ||
    proposalDecision === "DOCUMENTATION_COMPLETE";

  return {
    signal,
    fastPath: null,
    transitionTriggered: false,
    transitionResult: blocked ? "blocked" : "none",
    projectionUpdated: false,
    slotSyncTriggered: false,
    staleTriggered: false,
    invalidations: [],
  };
}

export function transitionSignalToTimelineExtras(input: {
  readonly signal: RequirementsTransitionSignal | null;
  readonly result: RequirementsTransitionResult;
}): Record<string, unknown> {
  const wireTarget = input.signal?.targetStage
    ? wireStageForOrchestrationStage(input.signal.targetStage)
    : null;
  return {
    ...(input.signal?.type ? { transitionSignal: input.signal.type } : {}),
    transitionResult: input.result.transitionResult,
    projectionUpdated: input.result.projectionUpdated,
    slotSyncTriggered: input.result.slotSyncTriggered,
    staleTriggered: input.result.staleTriggered,
    ...(input.result.invalidations.length ? { invalidations: [...input.result.invalidations] } : {}),
    ...(wireTarget ? { toStage: wireTarget } : {}),
    ...(input.signal?.sourceStage ? { fromStage: wireStageForOrchestrationStage(input.signal.sourceStage) ?? input.signal.sourceStage } : {}),
  };
}
