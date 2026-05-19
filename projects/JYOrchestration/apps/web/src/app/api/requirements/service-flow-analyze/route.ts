import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { runServiceFlowAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { mergeServiceFlowUserFacingMessage } from "@/lib/requirements/serviceFlowAnalyzeValidation";
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
  tryServiceFlowProposalDecisionFastPath,
  buildServiceFlowApplyTransitionMessage,
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
  proposalDecision?: string;
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
}) {
  let assistantMessage = input.parsed.assistantMessage;
  let nextQuestion = input.parsed.nextQuestion;
  let updatedFlow = input.parsed.updatedFlow;
  let quickReplies = input.parsed.quickReplies;

  if (
    input.proposalDecision === "APPLY" &&
    shouldBlockServiceFlowProposalReplay({
      flow: input.currentFlow,
      proposalDecision: input.proposalDecision,
      candidateAssistantMessage: assistantMessage,
    })
  ) {
    updatedFlow =
      input.currentFlow ??
      updatedFlow;
    assistantMessage = buildServiceFlowApplyTransitionMessage({
      flow: updatedFlow,
      projectName: input.projectName,
    });
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

  const promptTrace = buildSingleChatPromptTimelineEntry({
    action: (input.timelineExtras?.timelineAction as string) ?? "serviceFlowAnalyze",
    source: input.timelineExtras?.llmCallSkipped ? "internal" : input.proposalFallbackApplied ? "fallback" : "llm",
    timelineStage: input.agentCtx.timelineStage,
    stageGroup: input.agentCtx.stageGroup,
    workspaceScreenKey: input.agentCtx.workspaceScreenKey,
    selectedAgents: input.agentCtx.selectedAgents,
    ...(input.promptText ? { promptText: input.promptText } : {}),
    responseText: mergedAssistant.slice(0, 4000),
    model: input.model,
    provider: input.timelineExtras?.llmCallSkipped ? undefined : "openai",
    createdAtIso: new Date().toISOString(),
    visibleMessageSuppressed: presentation.suppressVisibleMessage,
    ...(presentation.suppressReason ? { suppressReason: presentation.suppressReason } : {}),
    serviceFlowVisibleMode: visibleMode,
    ...(input.quickActionLabel ? { quickActionLabel: input.quickActionLabel } : {}),
    ...(input.proposalDecision ? { proposalDecision: input.proposalDecision } : {}),
    ...(input.timelineExtras?.llmCallSkipped ? { llmCallSkipped: true } : {}),
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
  });

  const responseData = {
    assistantMessage:
      input.forceVisibleMode === "state_transition"
        ? mergedAssistant
        : presentation.visibleAssistantMessage || mergedAssistant,
    updatedFlow,
    nextQuestion: presentation.suppressVisibleMessage ? null : nextQuestion,
    quickReplies: presentation.visibleQuickReplies ?? quickReplies,
    intent: input.parsed.intent,
    readiness: input.parsed.readiness,
    visibleMode,
    visibleMessageSuppressed: presentation.suppressVisibleMessage,
    ...(presentation.suppressReason ? { suppressReason: presentation.suppressReason } : {}),
    ...(input.proposalDecision ? { proposalDecision: input.proposalDecision } : {}),
    ...(updatedFlow.acceptedProposalSnapshot
      ? { acceptedProposalSnapshot: updatedFlow.acceptedProposalSnapshot }
      : {}),
  };

  return NextResponse.json({ success: true, data: responseData, meta: { model: input.model, promptTrace } });
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
    const currentFlow = (body.currentFlow ?? null) as RequirementsServiceFlowV1 | null;
    const workspaceScreen = parseWorkspaceScreenForBody(body.workspaceScreenKey);

    const proposalDecision = resolveServiceFlowProposalDecision({
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

    const fastPath =
      proposalDecision === "APPLY" || proposalDecision === "REVIEW_FLOW"
        ? tryServiceFlowProposalDecisionFastPath({
            decision: proposalDecision,
            currentFlow,
            projectName,
          })
        : null;

    if (fastPath) {
      const parsed: ServiceFlowAnalyzeParsed & { updatedFlow: RequirementsServiceFlowV1 } = {
        assistantMessage: fastPath.assistantMessage,
        updatedFlow: fastPath.updatedFlow,
        intent: fastPath.intent,
        nextQuestion: fastPath.nextQuestion,
        quickReplies: [...fastPath.quickReplies],
        readiness: fastPath.readiness,
      };
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
        timelineExtras: {
          timelineAction: fastPath.timelineAction,
          llmCallSkipped: true,
          routingDecision: fastPath.routingDecision,
        },
      });
    }

    const llmUserMessage =
      proposalDecision && proposalDecision !== "REVIEW_FLOW"
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

    return buildAnalyzeSuccessResponse({
      parsed: result.data,
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
      timelineExtras: proposalDecision
        ? { routingDecision: `service_flow_proposal_decision_${proposalDecision.toLowerCase()}` }
        : {},
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/service-flow-analyze error:", error);
    return NextResponse.json({ success: false, message: "서비스 흐름 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
