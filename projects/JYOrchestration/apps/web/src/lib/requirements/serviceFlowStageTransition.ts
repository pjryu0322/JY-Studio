/**
 * QuickAction → orchestration stage transition (semantic intent, chip 문자열 하드코딩 분기 금지).
 */

import type { RequirementsStateJson, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import {
  resolveQuickActionIdFromLegacyLabel,
  resolveTransitionSignalFromQuickActionInput,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { seedFeaturePlanningArtifactFromServiceFlow } from "@/lib/requirements/seedFeaturePlanningFromServiceFlow";
import {
  hydrateServiceFlowStepsFromAlternativePayload,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  buildServiceFlowStateSummaryMessage,
  markServiceFlowProposalAccepted,
  type ServiceFlowDecisionFastPathResult,
} from "@/lib/requirements/serviceFlowProposalDecision";
import {
  quickRepliesForConversationState,
  quickReplyProfileForState,
  resolveServiceFlowConversationState,
  withServiceFlowConversationState,
  type ServiceFlowConversationState,
} from "@/lib/requirements/serviceFlowConversationState";
import { markFlowAsPrimaryProposalVariant } from "@/lib/requirements/serviceFlowProposalVariant";
import { syncServiceFlowToOrchestrationSlots } from "@/lib/requirements/serviceFlowOrchestrationSync";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import { planningTopicInstructionKo } from "@/lib/featurePlanning/featurePlanningTopic";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildApiDefineLowCoverageWarning,
  buildFeatureDetailBootstrapMessage,
  buildFeatureDetailDefineBlockedMessage,
  buildScreenDefineLowCoverageWarning,
  projectFeatureDetailMetrics,
  recordFeatureDetailMutation,
  resolveFocusFeatureSlot,
  seedFeatureDetailSlotsFromServiceFlow,
  type FeatureDetailSlotsV1,
} from "@/lib/requirements/featureDetailSlots";

export type ServiceFlowTransitionSignal =
  | "NEXT_STAGE"
  | "APPROVE_FLOW"
  | "DOCUMENTATION_COMPLETE"
  | "FEATURE_DETAIL_START"
  | "SCREEN_DEFINE_START"
  | "API_DEFINE_START"
  | "ACTION_ENTER_ACTOR_EDIT"
  | "ACTION_ADD_STEP";

export type ServiceFlowOrchestrationStageWire =
  | "IDEATION"
  | "SERVICE_FLOW_REVIEW"
  | "FEATURE_DETAIL"
  | "DOCUMENTATION_COMPLETE";

export type ServiceFlowStageTransitionMeta = Readonly<{
  quickActionType: ServiceFlowTransitionSignal;
  transitionTriggered: true;
  fromStage: ServiceFlowOrchestrationStageWire;
  toStage: ServiceFlowOrchestrationStageWire;
  transitionMode: "fast_path";
  orchestrationStateUpdated: boolean;
}>;

export type ServiceFlowStageTransitionFastPathResult = ServiceFlowDecisionFastPathResult &
  Readonly<{
    requirementsStatePatch?: Partial<RequirementsStateJson>;
    transitionMeta?: ServiceFlowStageTransitionMeta;
  }>;

/**
 * @deprecated Prefer `resolveTransitionSignalFromQuickActionInput` with `quickActionId`.
 * Legacy label → actionId mapping only (no RegExp transition inference).
 */
export function resolveServiceFlowTransitionSignal(input: {
  readonly label?: string | null;
  readonly userMessage?: string | null;
}): ServiceFlowTransitionSignal | null {
  const label = String(input.label ?? input.userMessage ?? "").trim();
  if (!label) return null;
  const quickActionId = resolveQuickActionIdFromLegacyLabel(label);
  if (!quickActionId) return null;
  return resolveTransitionSignalFromQuickActionInput({ quickActionId });
}

export function orchestrationStageFromConversation(
  state: ServiceFlowConversationState,
): ServiceFlowOrchestrationStageWire {
  if (state === "FEATURE_DETAIL") return "FEATURE_DETAIL";
  if (state === "APPROVED") return "SERVICE_FLOW_REVIEW";
  if (state === "REVIEW") return "SERVICE_FLOW_REVIEW";
  return "SERVICE_FLOW_REVIEW";
}

function buildOrchestrationStagePatch(input: {
  readonly toStage: ServiceFlowOrchestrationStageWire;
  readonly fromStage: ServiceFlowOrchestrationStageWire;
  readonly nowIso: string;
  readonly existing?: RequirementsStateJson["requirementsOrchestrationStageV1"] | null;
  readonly activePhase?: string | null;
}): NonNullable<RequirementsStateJson["requirementsOrchestrationStageV1"]> {
  const prev = new Set(input.existing?.completedStages ?? []);
  if (input.fromStage !== input.toStage) prev.add(input.fromStage);
  const defaultPhase =
    input.toStage === "FEATURE_DETAIL" ? "feature_detail_bootstrap" : input.toStage;
  return {
    currentStage: input.toStage,
    completedStages: [...prev],
    activePhase:
      input.activePhase !== undefined ? input.activePhase : defaultPhase,
    updatedAt: input.nowIso,
  };
}

export function buildContextAwareFeatureDetailBootstrapMessage(
  flow: RequirementsServiceFlowV1,
): string {
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  const steps = [...(hydrated.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);
  const firstStep = steps[0] ?? "핵심 흐름";

  const lines = [
    "현재 승인된 서비스 흐름을 기준으로 세부 기능 정의 단계로 이동합니다.",
    "",
    "확인된 흐름:",
    ...steps.map((t, i) => `- ${t}`),
    "",
    "이제 기능 단위로 세분화하겠습니다.",
    "",
    `우선 **${firstStep}** 기능에서 다음을 정리합니다:`,
    "- 입력 데이터",
    "- 처리 방식",
    "- 출력 결과",
    "- 예외 상황",
  ];
  return lines.join("\n").trim();
}

function firstOrderedFlowStepTitle(flow: RequirementsServiceFlowV1): string {
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  const steps = [...(hydrated.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);
  return steps[0] ?? "핵심 흐름";
}

export function buildScreenDefineBootstrapMessage(flow: RequirementsServiceFlowV1): string {
  const firstStep = firstOrderedFlowStepTitle(flow);
  const lines = [
    "세부 기능 정의 중 **화면 정의** 단계로 이동합니다.",
    "",
    `우선 **${firstStep}** 기능 기준으로 **화면 목록**을 정리합니다.`,
    "",
    "각 화면에 대해:",
    "- 화면 이름·역할",
    "- 주요 진입 경로",
    "- 연결되는 기능",
    "",
    planningTopicInstructionKo("SCREENS"),
  ];
  return lines.join("\n").trim();
}

export function buildApiDefineBootstrapMessage(
  flow: RequirementsServiceFlowV1,
  detailArtifact?: FeatureDetailSlotsV1 | null,
): string {
  const focus = detailArtifact ? resolveFocusFeatureSlot(detailArtifact) : null;
  const focusTitle = focus?.title ?? firstOrderedFlowStepTitle(flow);
  const lines = [
    "세부 기능 정의 중 **API 정의** 단계로 이동합니다.",
    "",
    `우선 **${focusTitle}** 기능 기준으로 **API·데이터 연동**을 정리합니다.`,
    "",
    "각 API에 대해:",
    "- 엔드포인트·메서드",
    "- 요청/응답 데이터",
    "- 연결 기능·화면",
    "",
    planningTopicInstructionKo("DATA"),
  ];
  return lines.join("\n").trim();
}

function patchFeaturePlanningForScreenDefine(
  artifact: FeaturePlanningSlotsArtifactV1 | null | undefined,
  nowIso: string,
): FeaturePlanningSlotsArtifactV1 | null {
  if (!artifact?.slots?.length) return artifact ?? null;
  return {
    ...artifact,
    planningTopic: "SCREENS",
    updatedAt: nowIso,
  };
}

function patchFeaturePlanningForApiDefine(
  artifact: FeaturePlanningSlotsArtifactV1 | null | undefined,
  nowIso: string,
): FeaturePlanningSlotsArtifactV1 | null {
  if (!artifact?.slots?.length) return artifact ?? null;
  return {
    ...artifact,
    planningTopic: "DATA",
    updatedAt: nowIso,
  };
}

function applyFlowApprovalMetadata(
  flow: RequirementsServiceFlowV1,
  nowIso: string,
  approvedBy?: string | null,
): RequirementsServiceFlowV1 {
  const version =
    String(flow.activeFlowVersion ?? "").trim() ||
    `flow-v${nowIso.replace(/[^\d]/g, "").slice(0, 14)}`;
  return {
    ...flow,
    flowApproved: true,
    flowApprovedAt: nowIso,
    ...(approvedBy ? { flowApprovedBy: approvedBy.slice(0, 120) } : {}),
    activeFlowVersion: version,
    updatedAt: nowIso,
  };
}

function computeReadiness(flow: RequirementsServiceFlowV1) {
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  const actorsReady = actors.length >= 2;
  const stepsReady = steps.length >= 3;
  const mappingReady = steps.every(
    (s) => s.primaryActorId && actors.some((a) => a.id === s.primaryActorId),
  );
  const readyForNext = actorsReady && stepsReady && mappingReady;
  const score = readyForNext ? 85 : stepsReady && actorsReady ? 55 : steps.length ? 25 : 10;
  return { score, actorsReady, stepsReady, mappingReady, readyForNext };
}

function buildTransitionFastPathResult(input: {
  readonly assistantMessage: string;
  readonly updatedFlow: RequirementsServiceFlowV1;
  readonly quickReplies: readonly string[];
  readonly routingDecision: string;
  readonly timelineAction: string;
  readonly proposalDecision: ServiceFlowProposalDecision;
  readonly conversationStateBefore: ServiceFlowConversationState;
  readonly conversationStateAfter: ServiceFlowConversationState;
  readonly transitionMeta: ServiceFlowStageTransitionMeta;
  readonly requirementsStatePatch?: Partial<RequirementsStateJson>;
  readonly readiness?: ReturnType<typeof computeReadiness>;
}): ServiceFlowStageTransitionFastPathResult {
  return {
    assistantMessage: input.assistantMessage,
    updatedFlow: input.updatedFlow,
    nextQuestion: null,
    quickReplies: input.quickReplies,
    intent: "unclear",
    readiness: input.readiness ?? computeReadiness(input.updatedFlow),
    visibleMode: "state_transition",
    routingDecision: input.routingDecision,
    timelineAction: input.timelineAction,
    llmCallSkipped: true,
    proposalDecision: input.proposalDecision,
    acceptedProposalSnapshot: input.assistantMessage.slice(0, 8000),
    conversationStateBefore: input.conversationStateBefore,
    conversationStateAfter: input.conversationStateAfter,
    reviewDepth: "compact",
    quickReplyProfile: quickReplyProfileForState(input.conversationStateAfter),
    requirementsStatePatch: input.requirementsStatePatch,
    transitionMeta: input.transitionMeta,
  };
}

export function handleQuickActionTransition(input: {
  readonly signal: ServiceFlowTransitionSignal;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly projectName?: string;
  readonly nowIso?: string;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration?: RequirementsStateJson["singleChatOrchestrationV1"] | null;
  readonly existingFeaturePlanning?: RequirementsStateJson["featurePlanningSlotsV1"] | null;
  readonly existingFeatureDetail?: RequirementsStateJson["featureDetailSlotsV1"] | null;
  readonly existingOrchestrationStage?: RequirementsStateJson["requirementsOrchestrationStageV1"] | null;
  readonly approvedBy?: string | null;
}): ServiceFlowStageTransitionFastPathResult | null {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const baseFlow = hydrateServiceFlowStepsFromAlternativePayload(
    input.currentFlow ?? {
      createdAt: nowIso,
      updatedAt: nowIso,
      actors: [],
      steps: [],
    },
  );
  const stateBefore = resolveServiceFlowConversationState(baseFlow);
  const fromStage = orchestrationStageFromConversation(stateBefore);

  if (input.signal === "APPROVE_FLOW") {
    if ((baseFlow.actors?.length ?? 0) < 1 || (baseFlow.steps?.length ?? 0) < 1) return null;
    const snapshot = buildServiceFlowStateSummaryMessage({ flow: baseFlow, heading: "", cta: "" });
    let updatedFlow = markServiceFlowProposalAccepted({
      flow: baseFlow,
      snapshot,
      decision: "FLOW_APPROVE",
      nowIso,
    });
    updatedFlow = applyFlowApprovalMetadata(updatedFlow, nowIso, input.approvedBy);
    const assistantMessage = [
      "서비스 흐름을 승인 상태로 반영했습니다.",
      "",
      "확정된 흐름",
      ...(updatedFlow.steps ?? [])
        .sort((a, b) => a.order - b.order)
        .map((s, i) => `${i + 1}. ${s.title}`),
      "",
      "다음: **다음 단계 진행** 또는 **세부 기능 정리**로 기능 단위 정의를 시작할 수 있습니다.",
    ].join("\n");

    const orchPatch = buildOrchestrationStagePatch({
      toStage: "SERVICE_FLOW_REVIEW",
      fromStage,
      nowIso,
      existing: input.existingOrchestrationStage,
    });
    let requirementsStatePatch: Partial<RequirementsStateJson> = {
      requirementsOrchestrationStageV1: orchPatch,
    };
    if (input.slotDefinitions?.length) {
      const sync = syncServiceFlowToOrchestrationSlots({
        flow: { ...updatedFlow, lastProposalDecision: "FLOW_APPROVE" },
        definitions: input.slotDefinitions,
        orchestration: input.orchestration,
        nowIso,
      });
      if (sync) {
        requirementsStatePatch = {
          ...requirementsStatePatch,
          singleChatOrchestrationV1: sync.state,
        };
      }
    }

    const readiness = { ...computeReadiness(updatedFlow), readyForNext: false };

    return buildTransitionFastPathResult({
      assistantMessage,
      updatedFlow,
      quickReplies: quickRepliesForConversationState("APPROVED"),
      routingDecision: "flow_approve_transition",
      timelineAction: "flowApprove",
      proposalDecision: "FLOW_APPROVE",
      readiness,
      conversationStateBefore: stateBefore,
      conversationStateAfter: "APPROVED",
      transitionMeta: {
        quickActionType: "APPROVE_FLOW",
        transitionTriggered: true,
        fromStage,
        toStage: "SERVICE_FLOW_REVIEW",
        transitionMode: "fast_path",
        orchestrationStateUpdated: true,
      },
      requirementsStatePatch,
    });
  }

  if (input.signal === "NEXT_STAGE" || input.signal === "FEATURE_DETAIL_START") {
    if ((baseFlow.actors?.length ?? 0) < 1 || (baseFlow.steps?.length ?? 0) < 1) return null;

    let flow = baseFlow;
    if (resolveServiceFlowConversationState(flow) !== "APPROVED") {
      const snapshot = buildServiceFlowStateSummaryMessage({ flow, heading: "", cta: "" });
      flow = markServiceFlowProposalAccepted({
        flow,
        snapshot,
        decision: "NEXT_STAGE",
        nowIso,
      });
    }
    flow = applyFlowApprovalMetadata(flow, nowIso, input.approvedBy);
    flow = markFlowAsPrimaryProposalVariant(flow, nowIso);
    flow = withServiceFlowConversationState(flow, "FEATURE_DETAIL", nowIso);
    flow = {
      ...flow,
      lastProposalDecision: "NEXT_STAGE",
      updatedAt: nowIso,
    };

    const featureDetailArtifact =
      input.existingFeatureDetail?.slots?.length ?
        input.existingFeatureDetail
      : seedFeatureDetailSlotsFromServiceFlow(flow, nowIso);
    const assistantMessage = buildFeatureDetailBootstrapMessage(flow, featureDetailArtifact);
    const featureArtifact =
      input.existingFeaturePlanning?.slots?.length ?
        input.existingFeaturePlanning
      : seedFeaturePlanningArtifactFromServiceFlow(flow, nowIso);

    const orchPatch = buildOrchestrationStagePatch({
      toStage: "FEATURE_DETAIL",
      fromStage,
      nowIso,
      existing: input.existingOrchestrationStage,
      activePhase: "feature_detail_bootstrap",
    });

    const requirementsStatePatch: Partial<RequirementsStateJson> = {
      requirementsOrchestrationStageV1: orchPatch,
      featurePlanningSlotsV1: featureArtifact,
      featureDetailSlotsV1: featureDetailArtifact,
    };

    if (input.slotDefinitions?.length) {
      const sync = syncServiceFlowToOrchestrationSlots({
        flow,
        definitions: input.slotDefinitions,
        orchestration: input.orchestration,
        nowIso,
      });
      if (sync) {
        requirementsStatePatch.singleChatOrchestrationV1 = sync.state;
      }
    }

    const proposalDecision =
      input.signal === "FEATURE_DETAIL_START" ? ("FEATURE_DETAIL" as const) : ("NEXT_STAGE" as const);
    return buildTransitionFastPathResult({
      assistantMessage,
      updatedFlow: flow,
      quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
      routingDecision: "service_flow_to_feature_detail_transition",
      timelineAction: input.signal === "FEATURE_DETAIL_START" ? "featureDetailTransition" : "stageTransitionNext",
      proposalDecision,
      conversationStateBefore: stateBefore,
      conversationStateAfter: "FEATURE_DETAIL",
      transitionMeta: {
        quickActionType: input.signal === "FEATURE_DETAIL_START" ? "FEATURE_DETAIL_START" : "NEXT_STAGE",
        transitionTriggered: true,
        fromStage,
        toStage: "FEATURE_DETAIL",
        transitionMode: "fast_path",
        orchestrationStateUpdated: Boolean(requirementsStatePatch.singleChatOrchestrationV1),
      },
      requirementsStatePatch,
    });
  }

  if (input.signal === "SCREEN_DEFINE_START") {
    if (stateBefore !== "FEATURE_DETAIL") return null;

    const detailArtifact = input.existingFeatureDetail;
    const metrics = projectFeatureDetailMetrics(detailArtifact);
    if (!metrics.hasConfirmedFeature) {
      return buildTransitionFastPathResult({
        assistantMessage: buildFeatureDetailDefineBlockedMessage(metrics, "screen"),
        updatedFlow: { ...baseFlow, updatedAt: nowIso },
        quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
        routingDecision: "screen_define_gated",
        timelineAction: "screenDefineBlocked",
        proposalDecision: "DIRECT_INPUT",
        conversationStateBefore: stateBefore,
        conversationStateAfter: "FEATURE_DETAIL",
        transitionMeta: {
          quickActionType: "SCREEN_DEFINE_START",
          transitionTriggered: false,
          fromStage,
          toStage: "FEATURE_DETAIL",
          transitionMode: "fast_path",
          orchestrationStateUpdated: false,
        },
      });
    }

    const coverageWarning = buildScreenDefineLowCoverageWarning(metrics);
    const assistantMessage = [
      buildScreenDefineBootstrapMessage(baseFlow),
      coverageWarning ? `\n\n${coverageWarning}` : "",
    ]
      .join("")
      .trim();
    const featureArtifact = patchFeaturePlanningForScreenDefine(input.existingFeaturePlanning, nowIso);
    const nextDetail =
      detailArtifact ?
        recordFeatureDetailMutation(detailArtifact, {
          featureAction: "screen_define_enter",
          mutationSource: "DEFINE_SCREEN",
        })
      : null;

    const orchPatch = buildOrchestrationStagePatch({
      toStage: "FEATURE_DETAIL",
      fromStage: "FEATURE_DETAIL",
      nowIso,
      existing: input.existingOrchestrationStage,
      activePhase: "screen_define",
    });

    const requirementsStatePatch: Partial<RequirementsStateJson> = {
      requirementsOrchestrationStageV1: orchPatch,
      ...(featureArtifact ? { featurePlanningSlotsV1: featureArtifact } : {}),
      ...(nextDetail ? { featureDetailSlotsV1: nextDetail } : {}),
    };

    const updatedFlow = {
      ...baseFlow,
      lastProposalDecision: "DIRECT_INPUT",
      updatedAt: nowIso,
    };

    return buildTransitionFastPathResult({
      assistantMessage,
      updatedFlow,
      quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
      routingDecision: "feature_detail_to_screen_define_transition",
      timelineAction: "screenDefineTransition",
      proposalDecision: "DIRECT_INPUT",
      conversationStateBefore: stateBefore,
      conversationStateAfter: "FEATURE_DETAIL",
      transitionMeta: {
        quickActionType: "SCREEN_DEFINE_START",
        transitionTriggered: true,
        fromStage,
        toStage: "FEATURE_DETAIL",
        transitionMode: "fast_path",
        orchestrationStateUpdated: true,
      },
      requirementsStatePatch,
    });
  }

  if (input.signal === "API_DEFINE_START") {
    if (stateBefore !== "FEATURE_DETAIL") return null;

    const detailArtifact = input.existingFeatureDetail;
    const metrics = projectFeatureDetailMetrics(detailArtifact);
    if (!metrics.hasConfirmedFeature) {
      return buildTransitionFastPathResult({
        assistantMessage: buildFeatureDetailDefineBlockedMessage(metrics, "api"),
        updatedFlow: { ...baseFlow, updatedAt: nowIso },
        quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
        routingDecision: "api_define_gated",
        timelineAction: "apiDefineBlocked",
        proposalDecision: "DIRECT_INPUT",
        conversationStateBefore: stateBefore,
        conversationStateAfter: "FEATURE_DETAIL",
        transitionMeta: {
          quickActionType: "API_DEFINE_START",
          transitionTriggered: false,
          fromStage,
          toStage: "FEATURE_DETAIL",
          transitionMode: "fast_path",
          orchestrationStateUpdated: false,
        },
      });
    }

    const coverageWarning = buildApiDefineLowCoverageWarning(metrics);
    const assistantMessage = [
      buildApiDefineBootstrapMessage(baseFlow, detailArtifact),
      coverageWarning ? `\n\n${coverageWarning}` : "",
    ]
      .join("")
      .trim();
    const featureArtifact = patchFeaturePlanningForApiDefine(input.existingFeaturePlanning, nowIso);
    const nextDetail =
      detailArtifact ?
        recordFeatureDetailMutation(detailArtifact, {
          featureAction: "api_define_enter",
          mutationSource: "DEFINE_API",
        })
      : null;

    const orchPatch = buildOrchestrationStagePatch({
      toStage: "FEATURE_DETAIL",
      fromStage: "FEATURE_DETAIL",
      nowIso,
      existing: input.existingOrchestrationStage,
      activePhase: "api_define",
    });

    const requirementsStatePatch: Partial<RequirementsStateJson> = {
      requirementsOrchestrationStageV1: orchPatch,
      ...(featureArtifact ? { featurePlanningSlotsV1: featureArtifact } : {}),
      ...(nextDetail ? { featureDetailSlotsV1: nextDetail } : {}),
    };

    const updatedFlow = {
      ...baseFlow,
      lastProposalDecision: "DIRECT_INPUT",
      updatedAt: nowIso,
    };

    return buildTransitionFastPathResult({
      assistantMessage,
      updatedFlow,
      quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
      routingDecision: "feature_detail_to_api_define_transition",
      timelineAction: "apiDefineTransition",
      proposalDecision: "DIRECT_INPUT",
      conversationStateBefore: stateBefore,
      conversationStateAfter: "FEATURE_DETAIL",
      transitionMeta: {
        quickActionType: "API_DEFINE_START",
        transitionTriggered: true,
        fromStage,
        toStage: "FEATURE_DETAIL",
        transitionMode: "fast_path",
        orchestrationStateUpdated: true,
      },
      requirementsStatePatch,
    });
  }

  return null;
}

export function proposalDecisionToTransitionSignal(
  decision: string | null | undefined,
): ServiceFlowTransitionSignal | null {
  const d = String(decision ?? "").trim().toUpperCase();
  if (!d) return null;
  if (d === "NEXT_STAGE") return "NEXT_STAGE";
  if (d === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (d === "FLOW_APPROVE") return "APPROVE_FLOW";
  if (d === "FEATURE_DETAIL") return "FEATURE_DETAIL_START";
  return null;
}

/** QuickAction / proposal decision → orchestration stage transition fast-path */
export function tryServiceFlowOrchestrationTransitionFastPath(input: {
  readonly proposalDecision: string | null;
  readonly quickActionId?: string | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly projectName?: string;
  readonly nowIso?: string;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration?: RequirementsStateJson["singleChatOrchestrationV1"] | null;
  readonly existingFeaturePlanning?: RequirementsStateJson["featurePlanningSlotsV1"] | null;
  readonly existingFeatureDetail?: RequirementsStateJson["featureDetailSlotsV1"] | null;
  readonly existingOrchestrationStage?: RequirementsStateJson["requirementsOrchestrationStageV1"] | null;
  readonly approvedBy?: string | null;
}): ServiceFlowStageTransitionFastPathResult | null {
  const signal = resolveTransitionSignalFromQuickActionInput({
    quickActionId: input.quickActionId,
    proposalDecision: input.proposalDecision as ServiceFlowProposalDecision | null,
  });
  if (!signal) return null;
  return handleQuickActionTransition({
    signal,
    currentFlow: input.currentFlow,
    projectName: input.projectName,
    nowIso: input.nowIso,
    slotDefinitions: input.slotDefinitions,
    orchestration: input.orchestration,
    existingFeaturePlanning: input.existingFeaturePlanning,
    existingFeatureDetail: input.existingFeatureDetail,
    existingOrchestrationStage: input.existingOrchestrationStage,
    approvedBy: input.approvedBy,
  });
}
