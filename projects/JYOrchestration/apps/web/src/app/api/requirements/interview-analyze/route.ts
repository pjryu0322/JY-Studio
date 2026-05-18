import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runInterviewAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { problemInterviewStateFromAnalyzerWireInput } from "@/lib/requirements/problemInterview";
import { buildOrchestrationInterviewDigest } from "@/lib/requirements/interviewSuggestionChips";
import {
  buildSingleChatPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { resolveSingleChatAgentContext } from "@/lib/requirements/singleChatAgentContext";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import { parseWorkspaceScreenKey, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";
import { resolveServicePlanningOrchestrationContext } from "@/lib/requirements/singleChatAgentContext";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  projectType?: string;
  userMessage?: string;
  latestAiQuestion?: string;
  /** 직전 질문의 슬롯 키(클라이언트 추정) */
  currentSlotKey?: string;
  currentInterviewState?: unknown;
  serviceDesignStage?: string;
  mentionedAI?: string | null;
  /** SingleChat 현재 화면 — 절차별 참여 Agent 매핑 조회용 */
  workspaceScreenKey?: string;
  singleChatOrchestrationV1?: unknown;
  /** 직전 턴에서 탭한 추천 칩(선택) */
  selectedSuggestion?: string;
  /** 사용자가 답글로 지정한 부모 메시지 id */
  replyToMessageId?: string;
  /** 부모가 인터뷰 AI 턴이면 슬롯 키 */
  replyToSlotKey?: string;
  /** 부모 AI speakerId */
  replyTargetSpeakerId?: string;
};

function parseWorkspaceScreenForBody(raw: unknown): WorkspaceScreenKey {
  const p = parseWorkspaceScreenKey(raw);
  return p ?? "requirements_ideation";
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const projectType = String(body.projectType ?? "").trim() || null;
    const userMessage = String(body.userMessage ?? "").trim();
    const selectedSuggestion = String(body.selectedSuggestion ?? "").trim() || null;
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const currentSlotKey = String(body.currentSlotKey ?? "").trim() || null;
    const nowIso = new Date().toISOString();
    const currentInterviewState = problemInterviewStateFromAnalyzerWireInput(body.currentInterviewState, nowIso);
    const workspaceScreen = parseWorkspaceScreenForBody(body.workspaceScreenKey);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/interview-analyze");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }
    }

    const agentCtx = await resolveSingleChatAgentContext(projectId, workspaceScreen);
    const servicePlanningAgents = projectId ? await resolveServicePlanningOrchestrationContext(projectId) : null;
    const servicePlanningCatalogKeys: WorkspaceAiMemberId[] = servicePlanningAgents
      ? servicePlanningAgents.selectedAgents
          .map((a) => (a.source === "catalog" ? a.catalogKey : undefined))
          .filter((x): x is WorkspaceAiMemberId => Boolean(String(x ?? "").trim()))
      : [];

    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName,
      projectDescription,
      projectType,
      servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys,
    });
    const orchParsed = parseRequirementsSingleChatOrchestrationV1(body.singleChatOrchestrationV1, defs);
    const orchestrationDigest =
      orchParsed && orchParsed.slotDefinitionsHash === hashSlotDefinitions(defs)
        ? buildOrchestrationInterviewDigest({ state: orchParsed, definitions: defs })
        : "";

    const replyToMessageId = String(body.replyToMessageId ?? "").trim() || null;
    const replyToSlotKey = String(body.replyToSlotKey ?? "").trim() || null;
    const replyTargetSpeakerId = String(body.replyTargetSpeakerId ?? "").trim() || null;

    const result = await runInterviewAnalyzeOpenAI({
      projectName,
      projectDescription,
      projectType,
      userMessage,
      latestAiQuestion,
      currentInterviewState,
      participatingAgentsPromptBlock: agentCtx.promptBlock,
      orchestrationDigest,
      selectedSuggestion,
      replyToMessageId,
      replyToSlotKey,
      replyTargetSpeakerId,
      currentSlotKey,
    });

    if (!result.ok) {
      const promptTrace = buildSingleChatPromptTimelineEntry({
        action: "problemInterviewAnalyze",
        source: "fallback",
        timelineStage: agentCtx.timelineStage,
        stageGroup: agentCtx.stageGroup,
        workspaceScreenKey: agentCtx.workspaceScreenKey,
        selectedAgents: agentCtx.selectedAgents,
        error: `${result.code}: ${result.message}`,
        fallbackText: "",
        interviewSuggestionsSource: "empty",
        ...(replyToMessageId ? { replyToMessageId } : {}),
        ...(replyToSlotKey ? { replyToSlotKey } : {}),
        ...(replyTargetSpeakerId ? { replyTargetSpeakerId } : {}),
      });
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          meta: { promptTrace, model: null },
        },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const s = result.payload.slots;
      console.log(
        "[problemInterview-analyzer]",
        `user="${userMessage.slice(0, 120).replace(/\s+/g, " ")}"`,
        `slots=${JSON.stringify(s)}`,
        `next=${JSON.stringify(result.payload.nextBestSlot)}`,
        `confidence=${result.payload.confidence}`
      );
    }

    const qNext = String(result.payload.nextInterviewQuestion ?? "").trim();
    const sugNext = result.payload.nextInterviewSuggestions?.length ? [...result.payload.nextInterviewSuggestions] : undefined;
    const analyzeSugSource = sugNext?.length ? ("llm" as const) : ("empty" as const);
    const promptTrace = buildSingleChatPromptTimelineEntry({
      action: "problemInterviewAnalyze",
      source: "llm",
      timelineStage: agentCtx.timelineStage,
      stageGroup: agentCtx.stageGroup,
      workspaceScreenKey: agentCtx.workspaceScreenKey,
      selectedAgents: agentCtx.selectedAgents,
      responseText: String(result.payload.summary ?? "").trim().slice(0, 2000),
      model: result.model,
      provider: "openai",
      createdAtIso: nowIso,
      previousQuestion: latestAiQuestion,
      userAnswer: userMessage,
      ...(currentSlotKey ? { currentSlotKey } : {}),
      ...(result.payload.slotAdvanceDecision ? { slotAdvanceDecision: result.payload.slotAdvanceDecision } : {}),
      ...(typeof result.payload.shouldAskFollowUp === "boolean" ? { shouldAskFollowUp: result.payload.shouldAskFollowUp } : {}),
      ...(result.payload.followUpReason ? { followUpReason: result.payload.followUpReason } : {}),
      ...(result.payload.nextQuestionSlotKey ? { nextQuestionSlotKey: result.payload.nextQuestionSlotKey } : {}),
      ...(qNext ? { interviewQuestion: qNext } : {}),
      ...(sugNext?.length ? { interviewSuggestions: sugNext } : {}),
      interviewSuggestionsSource: analyzeSugSource,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      ...(replyToSlotKey ? { replyToSlotKey } : {}),
      ...(replyTargetSpeakerId ? { replyTargetSpeakerId } : {}),
    });

    return NextResponse.json({
      success: true,
      data: result.payload,
      meta: { model: result.model, promptTrace },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/interview-analyze error:", error);
    return NextResponse.json({ success: false, message: "인터뷰 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
