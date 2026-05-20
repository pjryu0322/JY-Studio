import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  parseRequirementsOrchestrationStageV1,
  type RequirementsServiceFlowV1,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { parseFeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import { resolveServicePlanningOrchestrationContext } from "@/lib/requirements/singleChatAgentContext";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import {
  filterQuickActionsForStage,
  resolveAuthoritativeOrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  normalizeQuickRepliesToActions,
  quickActionsToLabels,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { appendOrchestrationTransitionTimelineExtras } from "@/lib/requirements/requirementsOrchestrationTimeline";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";
import { runServiceFlowAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { mergeServiceFlowUserFacingMessage } from "@/lib/requirements/serviceFlowAnalyzeValidation";
import {
  finalizeServiceFlowAssistantForResponse,
  resolveProposalPresentationVariantMode,
} from "@/lib/requirements/serviceFlowAssistantPresentation";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import { runServiceFlowAlternativeProposalTurn } from "@/lib/requirements/serviceFlowAlternativeProposal";
import { markFlowAsPrimaryProposalVariant } from "@/lib/requirements/serviceFlowProposalVariant";
import { resolveServiceFlowVisiblePresentation } from "@/lib/requirements/crossStageProposalDedupe";
import {
  buildSingleChatPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { resolveSingleChatAgentContext } from "@/lib/requirements/singleChatAgentContext";
import { parseWorkspaceScreenKey, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";
import { augmentUserMessageForLlm } from "@/lib/requirements/singleChatQuickAction";
import {
  resolveServiceFlowProposalDecision,
  shouldBlockServiceFlowProposalReplay,
  buildServiceFlowApprovedTransitionMessage,
  buildServiceFlowEnterReviewMessage,
  type ServiceFlowProposalDecision,
} from "@/lib/requirements/serviceFlowProposalDecision";
import type { ServiceFlowAnalyzeParsed } from "@/lib/requirements/serviceFlowAnalyzeValidation";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  ideationAssets?: Array<{ type?: string; title?: string; content?: string }>;
  userMessage?: string;
  currentFlow?: RequirementsServiceFlowV1 | null;
  recentMessages?: string;
  latestAiQuestion?: string;
  priorScreenHandoff?: string;
  serviceDesignStage?: string;
  mentionedAI?: string | null;
  responsePolicy?: unknown;
  /** SingleChat 현재 화면 — 절차별 참여 Agent 매핑 조회용 */
  workspaceScreenKey?: string;
  /** ideation→service-flow 자동 handoff(silentUserAppend) */
  autoHandoff?: boolean;
  quickActionLabel?: string;
  quickActionId?: string;
  proposalDecision?: string;
  singleChatOrchestrationV1?: unknown;
  requirementsOrchestrationStageV1?: unknown;
  featurePlanningSlotsV1?: unknown;
};

function parseWorkspaceScreenForBody(raw: unknown): WorkspaceScreenKey {
  const p = parseWorkspaceScreenKey(raw);
  return p ?? "requirements_service_flow";
}

function buildAnalyzeSuccessResponse(input: {
  readonly parsed: ServiceFlowAnalyzeParsed & { updatedFlow: RequirementsServiceFlowV1 };
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly priorScreenHandoff: string;
  readonly recentMessages: string;
  readonly autoHandoff: boolean;
  readonly quickActionLabel: string;
  readonly proposalDecision: ServiceFlowProposalDecision | null;
  readonly projectName: string;
  readonly model: string | null;
  readonly promptText?: string;
  readonly proposalFallbackApplied?: boolean;
  readonly agentCtx: Awaited<ReturnType<typeof resolveSingleChatAgentContext>>;
  readonly timelineExtras?: Record<string, unknown>;
  readonly forceVisibleMode?: "state_transition";
  readonly requirementsStatePatch?: Partial<RequirementsStateJson>;
}) {
  let assistantMessage = input.parsed.assistantMessage;
  let nextQuestion = input.parsed.nextQuestion;
  let updatedFlow = hydrateServiceFlowStepsFromAlternativePayload(input.parsed.updatedFlow);
  let quickReplies = input.parsed.quickReplies;

  if (
    input.proposalDecision === "FLOW_APPROVE" &&
    shouldBlockServiceFlowProposalReplay({
      flow: input.currentFlow,
      proposalDecision: "FLOW_APPROVE",
      candidateAssistantMessage: assistantMessage,
    })
  ) {
    updatedFlow = input.currentFlow ?? updatedFlow;
    assistantMessage = buildServiceFlowApprovedTransitionMessage({ flow: updatedFlow });
    nextQuestion = null;
  } else if (
    input.proposalDecision === "APPLY" &&
    shouldBlockServiceFlowProposalReplay({
      flow: input.currentFlow,
      proposalDecision: "APPLY",
      candidateAssistantMessage: assistantMessage,
    })
  ) {
    updatedFlow = input.currentFlow ?? updatedFlow;
    assistantMessage = buildServiceFlowEnterReviewMessage({ flow: updatedFlow });
    nextQuestion = null;
  }

  const mergedAssistant = mergeServiceFlowUserFacingMessage(assistantMessage, nextQuestion);
  const presentation = resolveServiceFlowVisiblePresentation({
    userMessage: input.userMessage,
    currentFlow: input.currentFlow,
    priorScreenHandoff: input.priorScreenHandoff,
    assistantMessage,
    nextQuestion,
    quickReplies,
    updatedFlow,
    recentMessages: input.recentMessages,
    autoHandoff: input.autoHandoff,
    ...(input.quickActionLabel ? { quickActionLabel: input.quickActionLabel } : {}),
    ...(input.forceVisibleMode === "state_transition" ? { forceVisibleProposal: true } : {}),
  });

  const visibleMode =
    input.forceVisibleMode === "state_transition"
      ? "state_transition"
      : presentation.mode;

  const responseQuickReplies = presentation.visibleQuickReplies ?? quickReplies;
  const presentationVariantMode = resolveProposalPresentationVariantMode({
    proposalDecision: input.proposalDecision,
    flowVariantMode: updatedFlow.proposalVariantMode ?? null,
  });
  const finalAssistant = finalizeServiceFlowAssistantForResponse({
    assistantMessage: mergedAssistant,
    nextQuestion: presentation.suppressVisibleMessage ? null : nextQuestion,
    quickReplies: responseQuickReplies,
    proposalVariantMode: presentationVariantMode,
  });

  const promptTrace = buildSingleChatPromptTimelineEntry({
    action: (input.timelineExtras?.timelineAction as string) ?? "serviceFlowAnalyze",
    source: input.timelineExtras?.llmCallSkipped ? "internal" : input.proposalFallbackApplied ? "fallback" : "llm",
    timelineStage: input.agentCtx.timelineStage,
    stageGroup: input.agentCtx.stageGroup,
    workspaceScreenKey: input.agentCtx.workspaceScreenKey,
    selectedAgents: input.agentCtx.selectedAgents,
    ...(input.promptText ? { promptText: input.promptText } : {}),
    responseText: finalAssistant.slice(0, 4000),
    model: input.model,
    provider: input.timelineExtras?.llmCallSkipped ? undefined : "openai",
    createdAtIso: new Date().toISOString(),
    visibleMessageSuppressed: presentation.suppressVisibleMessage,
    ...(presentation.suppressReason ? { suppressReason: presentation.suppressReason } : {}),
    serviceFlowVisibleMode: visibleMode,
    ...(input.quickActionLabel ? { quickActionLabel: input.quickActionLabel } : {}),
    ...(input.proposalDecision ? { proposalDecision: input.proposalDecision } : {}),
    ...(input.timelineExtras?.llmCallSkipped ? { llmCallSkipped: true } : {}),
    ...(typeof input.timelineExtras?.conversationStateBefore === "string"
      ? { conversationStateBefore: String(input.timelineExtras.conversationStateBefore) }
      : {}),
    ...(typeof input.timelineExtras?.conversationStateAfter === "string"
      ? { conversationStateAfter: String(input.timelineExtras.conversationStateAfter) }
      : {}),
    ...(typeof input.timelineExtras?.reviewDepth === "string"
      ? { reviewDepth: String(input.timelineExtras.reviewDepth) }
      : {}),
    ...(typeof input.timelineExtras?.quickReplyProfile === "string"
      ? { quickReplyProfile: String(input.timelineExtras.quickReplyProfile) }
      : {}),
    ...(typeof input.timelineExtras?.proposalVariantMode === "string"
      ? { proposalVariantMode: String(input.timelineExtras.proposalVariantMode) }
      : {}),
    ...(typeof input.timelineExtras?.proposalFingerprint === "string"
      ? { proposalFingerprint: String(input.timelineExtras.proposalFingerprint) }
      : {}),
    ...(typeof input.timelineExtras?.proposalDeltaScore === "number"
      ? { proposalDeltaScore: input.timelineExtras.proposalDeltaScore }
      : {}),
    ...(typeof input.timelineExtras?.alternativeGenerationReason === "string"
      ? { alternativeGenerationReason: String(input.timelineExtras.alternativeGenerationReason) }
      : {}),
    ...(typeof input.timelineExtras?.reviewMode === "string"
      ? { reviewMode: String(input.timelineExtras.reviewMode) }
      : {}),
    ...(input.timelineExtras?.routingDecision
      ? { routingDecision: String(input.timelineExtras.routingDecision) }
      : input.proposalFallbackApplied
        ? {
            routingDecision: "service_flow_proposal_fallback_synthesis",
            fallbackReason: "SERVICE_FLOW_PROPOSAL_VALIDATION_FAILED",
          }
        : presentation.suppressVisibleMessage
          ? { routingDecision: "service_flow_handoff_state_only" }
          : {}),
    ...(typeof input.timelineExtras?.quickActionType === "string"
      ? { quickActionType: String(input.timelineExtras.quickActionType) }
      : {}),
    ...(typeof input.timelineExtras?.quickActionId === "string"
      ? { quickActionId: String(input.timelineExtras.quickActionId) }
      : {}),
    ...(typeof input.timelineExtras?.transitionSignal === "string"
      ? { transitionSignal: String(input.timelineExtras.transitionSignal) }
      : {}),
    ...(typeof input.timelineExtras?.transitionResult === "string"
      ? { transitionResult: String(input.timelineExtras.transitionResult) }
      : {}),
    ...(input.timelineExtras?.projectionUpdated === true ? { projectionUpdated: true } : {}),
    ...(input.timelineExtras?.staleTriggered === true ? { staleTriggered: true } : {}),
    ...(Array.isArray(input.timelineExtras?.invalidations)
      ? { invalidations: input.timelineExtras.invalidations.map((x) => String(x)) }
      : {}),
    ...(input.timelineExtras?.transitionTriggered === true ? { transitionTriggered: true } : {}),
    ...(typeof input.timelineExtras?.fromStage === "string"
      ? { fromStage: String(input.timelineExtras.fromStage) }
      : {}),
    ...(typeof input.timelineExtras?.toStage === "string"
      ? { toStage: String(input.timelineExtras.toStage) }
      : {}),
    ...(typeof input.timelineExtras?.transitionMode === "string"
      ? { transitionMode: String(input.timelineExtras.transitionMode) }
      : {}),
    ...(input.timelineExtras?.orchestrationStateUpdated === true
      ? { orchestrationStateUpdated: true }
      : {}),
  });

  const responseData = {
    assistantMessage:
      input.forceVisibleMode === "state_transition"
        ? finalAssistant
        : presentation.visibleAssistantMessage || finalAssistant,
    updatedFlow,
    nextQuestion: presentation.suppressVisibleMessage ? null : nextQuestion,
    quickReplies: responseQuickReplies,
    intent: input.parsed.intent,
    readiness: input.parsed.readiness,
    visibleMode,
    visibleMessageSuppressed: presentation.suppressVisibleMessage,
    ...(presentation.suppressReason ? { suppressReason: presentation.suppressReason } : {}),
    ...(input.proposalDecision ? { proposalDecision: input.proposalDecision } : {}),
    ...(updatedFlow.acceptedProposalSnapshot
      ? { acceptedProposalSnapshot: updatedFlow.acceptedProposalSnapshot }
      : {}),
    ...(updatedFlow.conversationState ? { conversationState: updatedFlow.conversationState } : {}),
    ...(updatedFlow.alternativeProposalPayload
      ? { alternativeProposalPayload: updatedFlow.alternativeProposalPayload }
      : {}),
    ...(input.proposalDecision === "ALTERNATIVE" && updatedFlow.alternativeProposalPayload
      ? { openAlternativeCanvas: true }
      : {}),
  };

  return NextResponse.json({
    success: true,
    data: responseData,
    meta: {
      model: input.model,
      promptTrace,
      ...(input.requirementsStatePatch ? { requirementsStatePatch: input.requirementsStatePatch } : {}),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const ideationAssets = Array.isArray(body.ideationAssets) ? body.ideationAssets : [];
    const userMessage = String(body.userMessage ?? "").trim();
    const recentMessages = String(body.recentMessages ?? "").trim();
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const priorScreenHandoff = String(body.priorScreenHandoff ?? "").trim();
    const autoHandoff = body.autoHandoff === true;
    const quickActionLabel = typeof body.quickActionLabel === "string" ? String(body.quickActionLabel).trim() : "";
    const quickActionId = typeof body.quickActionId === "string" ? String(body.quickActionId).trim() : "";
    const currentFlow = (body.currentFlow ?? null) as RequirementsServiceFlowV1 | null;
    const workspaceScreen = parseWorkspaceScreenForBody(body.workspaceScreenKey);

    const proposalDecision = resolveServiceFlowProposalDecision({
      quickActionId: quickActionId || undefined,
      quickActionLabel: quickActionLabel || undefined,
      userMessage,
      proposalDecisionRaw: body.proposalDecision,
    });

    if (!projectId) return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    if (!userMessage) return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/service-flow-analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const agentCtx = await resolveSingleChatAgentContext(projectId, workspaceScreen);

    const servicePlanningAgents = await resolveServicePlanningOrchestrationContext(projectId);
    const servicePlanningCatalogKeys: WorkspaceAiMemberId[] = servicePlanningAgents
      ? servicePlanningAgents.selectedAgents
          .map((a) => (a.source === "catalog" ? a.catalogKey : undefined))
          .filter((x): x is WorkspaceAiMemberId => Boolean(String(x ?? "").trim()))
      : [];
    const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
      projectName,
      projectDescription,
      projectType: null,
      servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys,
    });
    const orchParsed = parseRequirementsSingleChatOrchestrationV1(body.singleChatOrchestrationV1, slotDefinitions);
    const orchestrationAligned =
      orchParsed && orchParsed.slotDefinitionsHash === hashSlotDefinitions(slotDefinitions) ? orchParsed : null;
    const existingOrchestrationStage = parseRequirementsOrchestrationStageV1(
      body.requirementsOrchestrationStageV1,
    );
    const fpRaw = body.featurePlanningSlotsV1;
    const existingFeaturePlanning =
      fpRaw === undefined || fpRaw === null
        ? null
        : parseFeaturePlanningSlotsArtifactV1(fpRaw) ?? null;

    const clientOrchestrationState: RequirementsStateJson = {
      serviceFlowV1: currentFlow,
      singleChatOrchestrationV1: orchestrationAligned,
      requirementsOrchestrationStageV1: existingOrchestrationStage ?? null,
      featurePlanningSlotsV1: existingFeaturePlanning,
    };

    const transitionEngineResult = applyRequirementsOrchestrationTransition({
      state: clientOrchestrationState,
      currentFlow,
      proposalDecision,
      quickActionId: quickActionId || undefined,
      quickActionLabel: quickActionLabel || undefined,
      userMessage,
      projectName,
      slotDefinitions,
      orchestration: orchestrationAligned,
      approvedBy: userId,
    });

    const fastPath = transitionEngineResult.fastPath;

    if (proposalDecision === "ALTERNATIVE") {
      const alt = await runServiceFlowAlternativeProposalTurn({
        projectName,
        projectDescription,
        ideationAssets,
        userMessage,
        quickActionLabel: quickActionLabel || userMessage,
        currentFlow,
        recentMessages,
        latestAiQuestion,
        priorScreenHandoff: priorScreenHandoff || undefined,
        participatingAgentsPromptBlock: agentCtx.promptBlock,
      });
      if (!alt.ok) {
        const promptTrace = buildSingleChatPromptTimelineEntry({
          action: "alternativeProposalGenerate",
          source: "fallback",
          timelineStage: agentCtx.timelineStage,
          stageGroup: agentCtx.stageGroup,
          workspaceScreenKey: agentCtx.workspaceScreenKey,
          selectedAgents: agentCtx.selectedAgents,
          error: `${alt.failureReason}: ${alt.message}`,
          proposalDecision: "ALTERNATIVE",
          proposalVariantMode: "ALTERNATIVE",
          routingDecision: alt.routingDecision,
          failureReason: alt.failureReason,
          ...(alt.alternativeBaselineSource ? { alternativeBaselineSource: alt.alternativeBaselineSource } : {}),
          alternativeBaselineRecovered: alt.alternativeBaselineRecovered,
        });
        return NextResponse.json(
          {
            success: false,
            code: alt.code,
            message: alt.message,
            meta: {
              model: null,
              promptTrace,
              userFacingMessage: alt.userFacingMessage,
              quickReplies: [...alt.quickReplies],
            },
          },
          { status: alt.code === "NO_KEY" ? 503 : 502 },
        );
      }
      return buildAnalyzeSuccessResponse({
        parsed: alt.data,
        userMessage,
        currentFlow,
        priorScreenHandoff,
        recentMessages,
        autoHandoff,
        quickActionLabel: quickActionLabel || userMessage,
        proposalDecision: "ALTERNATIVE",
        projectName,
        model: alt.model,
        promptText: alt.promptText,
        proposalFallbackApplied: alt.proposalFallbackApplied,
        agentCtx,
        forceVisibleMode: "state_transition",
        timelineExtras: {
          timelineAction: "alternativeProposalGenerate",
          routingDecision: alt.routingDecision,
          proposalVariantMode: alt.proposalVariantMode,
          proposalFingerprint: alt.proposalFingerprint,
          proposalDeltaScore: alt.proposalDeltaScore,
          alternativeBaselineSource: alt.alternativeBaselineSource,
          alternativeBaselineRecovered: alt.alternativeBaselineRecovered,
          ...(alt.alternativeGenerationReason ? { alternativeGenerationReason: alt.alternativeGenerationReason } : {}),
          reviewMode: "ALTERNATIVE_REVIEW",
          proposalVisualizationMode: "canvas",
          alternativeProposalId: alt.alternativeProposalPayload.proposalId,
          comparisonGenerated: true,
        },
      });
    }

    if (fastPath) {
      const mergedForStage: RequirementsStateJson = {
        ...clientOrchestrationState,
        ...(transitionEngineResult.requirementsStatePatch ?? {}),
        serviceFlowV1: fastPath.updatedFlow,
      };
      const stage = resolveAuthoritativeOrchestrationStage(mergedForStage);
      const projectedActions = filterQuickActionsForStage(
        stage,
        normalizeQuickRepliesToActions(fastPath.quickReplies),
      );
      const projectedQuickReplies = quickActionsToLabels(projectedActions);

      const fpAssistant = finalizeServiceFlowAssistantForResponse({
        assistantMessage: fastPath.assistantMessage,
        nextQuestion: null,
        quickReplies: projectedQuickReplies,
        proposalVariantMode: "PRIMARY",
      });
      const parsed: ServiceFlowAnalyzeParsed & { updatedFlow: RequirementsServiceFlowV1 } = {
        assistantMessage: fpAssistant,
        updatedFlow: fastPath.updatedFlow,
        intent: fastPath.intent,
        nextQuestion: fastPath.nextQuestion,
        quickReplies: [...projectedQuickReplies],
        readiness: fastPath.readiness,
      };
      const transitionMeta =
        "transitionMeta" in fastPath && fastPath.transitionMeta ? fastPath.transitionMeta : null;
      return buildAnalyzeSuccessResponse({
        parsed,
        userMessage,
        currentFlow,
        priorScreenHandoff,
        recentMessages,
        autoHandoff,
        quickActionLabel: quickActionLabel || userMessage,
        proposalDecision: fastPath.proposalDecision,
        projectName,
        model: null,
        agentCtx,
        forceVisibleMode: "state_transition",
        requirementsStatePatch: transitionEngineResult.requirementsStatePatch,
        timelineExtras: appendOrchestrationTransitionTimelineExtras({
          base: {
            timelineAction: fastPath.timelineAction,
            llmCallSkipped: true,
            routingDecision: fastPath.routingDecision,
            conversationStateBefore: fastPath.conversationStateBefore,
            conversationStateAfter: fastPath.conversationStateAfter,
            reviewDepth: fastPath.reviewDepth,
            quickReplyProfile: fastPath.quickReplyProfile,
            ...(quickActionId ? { quickActionId } : {}),
            ...(quickActionLabel ? { quickActionLabel } : {}),
          },
          transitionMeta,
          transitionEngine: transitionEngineResult,
        }),
      });
    }

    if (transitionEngineResult.transitionResult === "blocked") {
      return NextResponse.json(
        {
          success: false,
          message: "단계 전환을 처리할 수 없습니다. 서비스 흐름(액터·단계)을 먼저 확정해 주세요.",
          meta: {
            model: null,
            promptTrace: buildSingleChatPromptTimelineEntry({
              action: "stageTransitionBlocked",
              source: "internal",
              timelineStage: agentCtx.timelineStage,
              stageGroup: agentCtx.stageGroup,
              workspaceScreenKey: agentCtx.workspaceScreenKey,
              selectedAgents: agentCtx.selectedAgents,
              ...(proposalDecision ? { proposalDecision } : {}),
              routingDecision: "stage_transition_precondition_failed",
            }),
          },
        },
        { status: 422 },
      );
    }

    const llmAugmentable =
      proposalDecision === "PARTIAL_EDIT" ||
      proposalDecision === "DIRECT_INPUT" ||
      proposalDecision === "HOLD";
    const llmUserMessage = llmAugmentable
      ? augmentUserMessageForLlm(userMessage, quickActionLabel || userMessage, proposalDecision)
      : userMessage;

    const result = await runServiceFlowAnalyzeOpenAI({
      projectName,
      projectDescription,
      ideationAssets,
      userMessage: llmUserMessage,
      currentFlow,
      recentMessages,
      latestAiQuestion,
      priorScreenHandoff: priorScreenHandoff || undefined,
      participatingAgentsPromptBlock: agentCtx.promptBlock,
    });

    if (!result.ok) {
      const promptTrace = buildSingleChatPromptTimelineEntry({
        action: "serviceFlowAnalyze",
        source: "fallback",
        timelineStage: agentCtx.timelineStage,
        stageGroup: agentCtx.stageGroup,
        workspaceScreenKey: agentCtx.workspaceScreenKey,
        selectedAgents: agentCtx.selectedAgents,
        ...(result.promptText ? { promptText: result.promptText } : {}),
        error: `${result.code}: ${result.message}`,
        fallbackText: "",
        ...(quickActionLabel ? { quickActionLabel } : {}),
        ...(proposalDecision ? { proposalDecision } : {}),
      });
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          meta: { model: null, promptTrace },
        },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    const primaryFlow = !result.data.updatedFlow.proposalVariantMode
      ? markFlowAsPrimaryProposalVariant(result.data.updatedFlow)
      : result.data.updatedFlow;

    return buildAnalyzeSuccessResponse({
      parsed: { ...result.data, updatedFlow: primaryFlow },
      userMessage,
      currentFlow,
      priorScreenHandoff,
      recentMessages,
      autoHandoff,
      quickActionLabel: quickActionLabel || userMessage,
      proposalDecision,
      projectName,
      model: result.model,
      promptText: result.promptText,
      proposalFallbackApplied: result.proposalFallbackApplied,
      agentCtx,
      timelineExtras: {
        ...(proposalDecision
          ? { routingDecision: `service_flow_proposal_decision_${proposalDecision.toLowerCase()}` }
          : {}),
        proposalVariantMode: primaryFlow.proposalVariantMode ?? "PRIMARY",
        reviewMode: primaryFlow.reviewMode ?? "PRIMARY_REVIEW",
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/service-flow-analyze error:", error);
    return NextResponse.json({ success: false, message: "서비스 흐름 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
